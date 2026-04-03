import { db } from "@/server/infrastructure/prisma/client";
import { getWorkspaceBillingSummary } from "@/server/application/billing/billing-service";
import { getGoogleOauthConfig } from "@/lib/email/google";
import { getGmailConnectionSnapshot } from "@/lib/email/gmail-connection";

export type ProviderHealthSnapshot = {
  googleOauth: {
    configured: boolean;
    clientIdPresent: boolean;
    clientSecretPresent: boolean;
    redirectUri: string;
    appBaseUrl: string;
  };
  gmail: {
    connected: boolean;
    hasMailboxScope: boolean;
    hasSendScope: boolean;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
  };
  billing: {
    provider: string | null;
    configured: boolean;
    status: string | null;
    planCode: string | null;
    planName: string | null;
    note: string;
  };
  jobs: {
    pendingCount: number;
    runningCount: number;
    failedCount: number;
  };
};

export async function getWorkspaceProviderHealth(input: {
  userId: string;
  workspaceId: string;
}): Promise<ProviderHealthSnapshot> {
  const [gmailSnapshot, billingSummary, jobCounts] = await Promise.all([
    getGmailConnectionSnapshot(input.userId),
    getWorkspaceBillingSummary(input.workspaceId),
    Promise.all([
      db.appJob.count({
        where: {
          workspaceId: input.workspaceId,
          status: "PENDING",
        },
      }),
      db.appJob.count({
        where: {
          workspaceId: input.workspaceId,
          status: "RUNNING",
        },
      }),
      db.appJob.count({
        where: {
          workspaceId: input.workspaceId,
          status: "FAILED",
        },
      }),
    ]),
  ]);

  const oauthConfig = getGoogleOauthConfig();
  const provider = billingSummary.planCode ? "INTERNAL" : null;

  return {
    googleOauth: {
      configured: oauthConfig.isConfigured,
      clientIdPresent: Boolean(oauthConfig.clientId),
      clientSecretPresent: Boolean(oauthConfig.clientSecret),
      redirectUri: oauthConfig.redirectUri,
      appBaseUrl: oauthConfig.appBaseUrl,
    },
    gmail: {
      connected: Boolean(gmailSnapshot.source),
      hasMailboxScope: Boolean(gmailSnapshot.source?.hasMailboxScope),
      hasSendScope: Boolean(gmailSnapshot.source?.hasSendScope),
      lastSyncedAt: gmailSnapshot.source?.lastSyncedAt ?? null,
      lastSyncError: gmailSnapshot.source?.lastSyncError ?? null,
    },
    billing: {
      provider,
      configured: billingSummary.planCode !== null,
      status: billingSummary.status,
      planCode: billingSummary.planCode,
      planName: billingSummary.planName,
      note:
        provider === "INTERNAL"
          ? "Le billing repose encore sur le provider interne de bootstrap."
          : "Aucun provider billing n est encore configure pour ce workspace.",
    },
    jobs: {
      pendingCount: jobCounts[0],
      runningCount: jobCounts[1],
      failedCount: jobCounts[2],
    },
  };
}
