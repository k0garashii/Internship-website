import { randomUUID } from "node:crypto";

import { AppJobStatus, type AppJobType, type Prisma } from "@prisma/client";

import { db } from "@/server/infrastructure/prisma/client";

export type EnqueueAppJobInput = {
  type: AppJobType;
  payload: Prisma.InputJsonValue;
  userId?: string | null;
  workspaceId?: string | null;
  availableAt?: Date;
  scheduledAt?: Date | null;
  maxAttempts?: number;
};

function computeRetryDelayMs(attemptCount: number) {
  return Math.min(1000 * 60 * 30, 1000 * 15 * Math.max(1, attemptCount));
}

export async function enqueueAppJob(input: EnqueueAppJobInput) {
  return db.appJob.create({
    data: {
      type: input.type,
      payload: input.payload,
      userId: input.userId ?? null,
      workspaceId: input.workspaceId ?? null,
      availableAt: input.availableAt ?? new Date(),
      scheduledAt: input.scheduledAt ?? null,
      maxAttempts: input.maxAttempts ?? 5,
      status: AppJobStatus.PENDING,
    },
  });
}

export async function claimNextAppJob(types?: AppJobType[]) {
  return db.$transaction(async (tx) => {
    const candidate = await tx.appJob.findFirst({
      where: {
        status: AppJobStatus.PENDING,
        availableAt: {
          lte: new Date(),
        },
        ...(types && types.length > 0
          ? {
              type: {
                in: types,
              },
            }
          : {}),
      },
      orderBy: [{ scheduledAt: "asc" }, { availableAt: "asc" }, { createdAt: "asc" }],
    });

    if (!candidate) {
      return null;
    }

    const lockToken = randomUUID();

    // Conditional update: if another worker claimed the job in between, nothing
    // is updated and this worker skips it instead of running it twice.
    const claimed = await tx.appJob.updateMany({
      where: {
        id: candidate.id,
        status: AppJobStatus.PENDING,
      },
      data: {
        status: AppJobStatus.RUNNING,
        lockToken,
        lockedAt: new Date(),
        startedAt: candidate.startedAt ?? new Date(),
        attemptCount: {
          increment: 1,
        },
      },
    });

    if (claimed.count === 0) {
      return null;
    }

    return tx.appJob.findUnique({
      where: {
        id: candidate.id,
      },
    });
  });
}

// A serverless invocation can be killed mid-job, leaving it RUNNING forever.
// Such jobs go back to the queue, or fail once their attempts are exhausted.
export async function releaseStaleAppJobs(staleAfterMs: number) {
  const staleBefore = new Date(Date.now() - staleAfterMs);
  const where = {
    status: AppJobStatus.RUNNING,
    lockedAt: {
      lt: staleBefore,
    },
  };
  const [failed, requeued] = await db.$transaction([
    db.appJob.updateMany({
      where: {
        ...where,
        attemptCount: {
          gte: db.appJob.fields.maxAttempts,
        },
      },
      data: {
        status: AppJobStatus.FAILED,
        lastError: "Job interrupted before completion",
        finishedAt: new Date(),
        lockToken: null,
        lockedAt: null,
      },
    }),
    db.appJob.updateMany({
      where,
      data: {
        status: AppJobStatus.PENDING,
        lastError: "Job interrupted before completion, requeued",
        lockToken: null,
        lockedAt: null,
      },
    }),
  ]);

  return {
    failedCount: failed.count,
    requeuedCount: requeued.count,
  };
}

export async function completeAppJob(
  jobId: string,
  output?: Prisma.InputJsonValue | null,
) {
  return db.$transaction(async (tx) => {
    const updatedJob = await tx.appJob.update({
      where: {
        id: jobId,
      },
      data: {
        status: AppJobStatus.SUCCEEDED,
        finishedAt: new Date(),
        lastError: null,
        lockToken: null,
        lockedAt: null,
      },
    });

    await tx.appJobRun.create({
      data: {
        jobId,
        status: AppJobStatus.SUCCEEDED,
        startedAt: updatedJob.startedAt ?? new Date(),
        finishedAt: updatedJob.finishedAt ?? new Date(),
        output: output ?? undefined,
      },
    });

    return updatedJob;
  });
}

export async function failAppJob(jobId: string, errorMessage: string) {
  return db.$transaction(async (tx) => {
    const job = await tx.appJob.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) {
      return null;
    }

    const shouldRetry = job.attemptCount < job.maxAttempts;
    const nextAvailableAt = shouldRetry
      ? new Date(Date.now() + computeRetryDelayMs(job.attemptCount))
      : null;

    const updated = await tx.appJob.update({
      where: {
        id: jobId,
      },
      data: {
        status: shouldRetry ? AppJobStatus.PENDING : AppJobStatus.FAILED,
        availableAt: nextAvailableAt ?? job.availableAt,
        finishedAt: shouldRetry ? null : new Date(),
        lastError: errorMessage.slice(0, 1000),
        lockToken: null,
        lockedAt: null,
      },
    });

    await tx.appJobRun.create({
      data: {
        jobId,
        status: shouldRetry ? AppJobStatus.PENDING : AppJobStatus.FAILED,
        startedAt: job.startedAt ?? new Date(),
        finishedAt: shouldRetry ? null : new Date(),
        errorMessage: errorMessage.slice(0, 1000),
      },
    });

    return updated;
  });
}

export async function cancelAppJob(jobId: string) {
  return db.appJob.update({
    where: {
      id: jobId,
    },
    data: {
      status: AppJobStatus.CANCELED,
      finishedAt: new Date(),
      lockToken: null,
      lockedAt: null,
    },
  });
}

export async function listPendingAppJobs(limit = 25) {
  return db.appJob.findMany({
    where: {
      status: {
        in: [AppJobStatus.PENDING, AppJobStatus.RUNNING],
      },
    },
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });
}
