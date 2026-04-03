import { AppJobType, type Prisma } from "@prisma/client";

import { exportUserConfig } from "@/lib/config/user-config";
import { syncGmailMailbox } from "@/lib/email/gmail-sync";
import { logServiceError, logServiceEvent } from "@/lib/observability/error-logging";
import { refreshProfileEnrichment } from "@/lib/profile/enrichment";
import { discoverInitialOffers } from "@/lib/search/discovery";
import { persistSearchDiscoveryResult } from "@/lib/search/persistence";
import { getEffectiveInferredPreferences } from "@/server/application/personalization/profile-inference-service";
import {
  claimNextAppJob,
  completeAppJob,
  failAppJob,
} from "@/server/application/jobs/job-queue-service";

type WorkerExecutionResult =
  | {
      status: "idle";
    }
  | {
      status: "processed";
      jobId: string;
      type: AppJobType;
    };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function processProfileEnrichmentJob(payload: unknown) {
  if (!isObject(payload) || typeof payload.userId !== "string") {
    throw new Error("Invalid profile enrichment payload");
  }

  await refreshProfileEnrichment(payload.userId);

  return {
    userId: payload.userId,
  };
}

async function processSearchDiscoveryJob(payload: unknown) {
  if (!isObject(payload) || typeof payload.userId !== "string") {
    throw new Error("Invalid search discovery payload");
  }

  const viewer = {
    userId: payload.userId,
    workspaceId: typeof payload.workspaceId === "string" ? payload.workspaceId : undefined,
  };
  const config = await exportUserConfig(viewer);
  const inferredPreferences = await getEffectiveInferredPreferences(
    payload.userId,
    typeof payload.workspaceId === "string" ? payload.workspaceId : undefined,
  );
  const result = await discoverInitialOffers({
    ...config,
    inferredPreferences,
  });
  const persistence = await persistSearchDiscoveryResult(viewer, result);

  return {
    userId: payload.userId,
    searchRunId: persistence.searchRunId,
    persistedOfferCount: persistence.persistedOfferCount,
  };
}

async function processGmailSyncJob(payload: unknown) {
  if (!isObject(payload) || typeof payload.userId !== "string") {
    throw new Error("Invalid Gmail sync payload");
  }

  const result = await syncGmailMailbox(payload.userId);

  return {
    userId: payload.userId,
    detectedReplyCount: result.detectedReplyCount,
  };
}

const jobProcessors: Record<AppJobType, (payload: unknown) => Promise<unknown>> = {
  [AppJobType.PROFILE_ENRICHMENT_REFRESH]: processProfileEnrichmentJob,
  [AppJobType.SEARCH_DISCOVERY_RUN]: processSearchDiscoveryJob,
  [AppJobType.GMAIL_SYNC]: processGmailSyncJob,
};

export async function runWorkerOnce(): Promise<WorkerExecutionResult> {
  const job = await claimNextAppJob();

  if (!job) {
    return {
      status: "idle",
    };
  }

  const processor = jobProcessors[job.type];

  if (!processor) {
    await failAppJob(job.id, `No worker processor registered for ${job.type}`);
    return {
      status: "processed",
      jobId: job.id,
      type: job.type,
    };
  }

  try {
    const output = await processor(job.payload);

    await completeAppJob(
      job.id,
      (isObject(output) ? output : null) as Prisma.InputJsonValue | null,
    );

    logServiceEvent({
      scope: "jobs/worker",
      message: "Application job processed",
      metadata: {
        jobId: job.id,
        type: job.type,
      },
    });

    return {
      status: "processed",
      jobId: job.id,
      type: job.type,
    };
  } catch (error) {
    await failAppJob(
      job.id,
      error instanceof Error ? error.message : "Unknown worker failure",
    );

    logServiceError({
      scope: "jobs/worker",
      message: "Application job failed",
      error,
      metadata: {
        jobId: job.id,
        type: job.type,
      },
    });

    return {
      status: "processed",
      jobId: job.id,
      type: job.type,
    };
  }
}

export async function runWorkerUntilDrained(maxIterations = 25) {
  let processedCount = 0;

  while (processedCount < maxIterations) {
    const result = await runWorkerOnce();

    if (result.status === "idle") {
      break;
    }

    processedCount += 1;
  }

  return {
    processedCount,
  };
}
