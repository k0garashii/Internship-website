import { AppJobStatus, AppJobType, FeedbackDecision, UserStatus } from "@prisma/client";

import { sendUserNotificationEmail } from "@/lib/email/notifications";
import { logServiceError, logServiceEvent } from "@/lib/observability/error-logging";
import { buildDailyDigest } from "@/server/application/alerts/daily-digest";
import { checkOfferAvailability } from "@/server/application/alerts/offer-availability";
import { enqueueAppJob, releaseStaleAppJobs } from "@/server/application/jobs/job-queue-service";
import { runWorkerOnce } from "@/server/application/jobs/job-worker-service";
import { db } from "@/server/infrastructure/prisma/client";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SEARCH_INTERVAL_MS = 20 * HOUR_MS;
const DIGEST_INTERVAL_MS = 20 * HOUR_MS;
// A digest waits for the user's daily search, but never more than this.
const DIGEST_MAX_WAIT_MS = 30 * HOUR_MS;
const STALE_JOB_AFTER_MS = 10 * 60 * 1000;
// A search can take most of an invocation: only start one with this much left.
const MIN_TIME_TO_START_JOB_MS = 35_000;
const MIN_TIME_FOR_AVAILABILITY_BATCH_MS = 10_000;
const MIN_TIME_FOR_DIGEST_MS = 3_000;
const AVAILABILITY_RECHECK_MS = 3 * DAY_MS;
const AVAILABILITY_LOOKBACK_MS = 60 * DAY_MS;
const AVAILABILITY_BATCH_SIZE = 5;
const MAX_AVAILABILITY_CHECKS_PER_RUN = 20;
const MAX_DIGESTS_PER_RUN = 20;
const DIGEST_OFFER_LIMIT = 8;
const DIGEST_MIN_SCORE = 0.5;
const UPCOMING_INTERVIEW_WINDOW_MS = 2 * DAY_MS;
const ACTIVE_SEARCH_JOB_STATUSES = [AppJobStatus.PENDING, AppJobStatus.RUNNING];

function getAppBaseUrl() {
  return (process.env.APP_BASE_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

function remainingMs(deadline: number) {
  return deadline - Date.now();
}

async function enqueueDueSearches(now: Date) {
  const users = await db.user.findMany({
    where: {
      status: UserStatus.ACTIVE,
      profile: { dailyDigestEnabled: true },
      searchTargets: { some: {} },
      jobs: {
        none: {
          type: AppJobType.SEARCH_DISCOVERY_RUN,
          status: { in: ACTIVE_SEARCH_JOB_STATUSES },
        },
      },
      searchRuns: {
        none: { createdAt: { gt: new Date(now.getTime() - SEARCH_INTERVAL_MS) } },
      },
    },
    select: { id: true, activeWorkspaceId: true },
    take: 500,
  });

  for (const user of users) {
    await enqueueAppJob({
      type: AppJobType.SEARCH_DISCOVERY_RUN,
      userId: user.id,
      workspaceId: user.activeWorkspaceId,
      payload: { userId: user.id, workspaceId: user.activeWorkspaceId, trigger: "daily" },
      maxAttempts: 2,
    });
  }

  return users.length;
}

async function runQueuedJobs(deadline: number) {
  let processed = 0;

  while (remainingMs(deadline) > MIN_TIME_TO_START_JOB_MS) {
    const result = await runWorkerOnce();

    if (result.status === "idle") {
      break;
    }

    processed += 1;
  }

  return processed;
}

async function checkFollowedOfferAvailability(now: Date, deadline: number) {
  const offers = await db.jobOffer.findMany({
    where: {
      expiredAt: null,
      lastSeenAt: { gte: new Date(now.getTime() - AVAILABILITY_LOOKBACK_MS) },
      OR: [
        { availabilityCheckedAt: null },
        { availabilityCheckedAt: { lt: new Date(now.getTime() - AVAILABILITY_RECHECK_MS) } },
      ],
    },
    orderBy: { availabilityCheckedAt: { sort: "asc", nulls: "first" } },
    select: { id: true, sourceUrl: true },
    take: MAX_AVAILABILITY_CHECKS_PER_RUN,
  });
  let checked = 0;
  let expired = 0;

  for (let index = 0; index < offers.length; index += AVAILABILITY_BATCH_SIZE) {
    if (remainingMs(deadline) < MIN_TIME_FOR_AVAILABILITY_BATCH_MS) {
      break;
    }

    const batch = offers.slice(index, index + AVAILABILITY_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (offer) => ({
        offer,
        availability: await checkOfferAvailability(offer.sourceUrl),
      })),
    );

    for (const { offer, availability } of results) {
      await db.jobOffer.update({
        where: { id: offer.id },
        data: {
          availabilityCheckedAt: now,
          ...(availability === "expired" ? { expiredAt: now } : {}),
        },
      });
      checked += 1;
      expired += availability === "expired" ? 1 : 0;
    }
  }

  return { checked, expired };
}

async function sendDigestForUser(
  user: { id: string; email: string; fullName: string | null; lastDigestSentAt: Date | null },
  now: Date,
) {
  const since = user.lastDigestSentAt ?? new Date(now.getTime() - DAY_MS);
  const [candidateOffers, followUpsDue, upcomingInterviews, expiredOfferCount] = await Promise.all([
    db.jobOffer.findMany({
      where: {
        userId: user.id,
        firstSeenAt: { gt: since },
        expiredAt: null,
        feedbackEntries: { none: { decision: FeedbackDecision.NOT_RELEVANT } },
      },
      select: {
        id: true,
        title: true,
        companyName: true,
        locationLabel: true,
        searchMatches: {
          orderBy: { normalizedScore: "desc" },
          take: 1,
          select: { normalizedScore: true },
        },
      },
      take: 50,
    }),
    db.jobOffer.findMany({
      where: { userId: user.id, nextFollowUpAt: { lte: now } },
      select: { title: true, companyName: true, nextFollowUpAt: true },
      orderBy: { nextFollowUpAt: "asc" },
      take: 10,
    }),
    db.jobOffer.findMany({
      where: {
        userId: user.id,
        interviewAt: { gte: now, lte: new Date(now.getTime() + UPCOMING_INTERVIEW_WINDOW_MS) },
      },
      select: { title: true, companyName: true, interviewAt: true },
      orderBy: { interviewAt: "asc" },
    }),
    db.jobOffer.count({
      where: {
        userId: user.id,
        expiredAt: { gt: since },
        feedbackEntries: {
          some: { decision: { in: [FeedbackDecision.FAVORITE, FeedbackDecision.APPLIED] } },
        },
      },
    }),
  ]);
  const appBaseUrl = getAppBaseUrl();
  const newOffers = candidateOffers
    .map((offer) => ({ offer, score: offer.searchMatches[0]?.normalizedScore ?? null }))
    .filter(({ score }) => score === null || score >= DIGEST_MIN_SCORE)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, DIGEST_OFFER_LIMIT)
    .map(({ offer, score }) => ({
      title: offer.title,
      companyName: offer.companyName,
      locationLabel: offer.locationLabel,
      scorePercent: score === null ? null : Math.round(score * 100),
      url: `${appBaseUrl}/workspace/search/offers/${offer.id}`,
    }));
  const digest = buildDailyDigest({
    firstName: user.fullName?.split(" ")[0] ?? null,
    appBaseUrl,
    newOffers,
    followUpsDue: followUpsDue.map((offer) => ({
      title: offer.title,
      companyName: offer.companyName,
      date: offer.nextFollowUpAt as Date,
    })),
    upcomingInterviews: upcomingInterviews.map((offer) => ({
      title: offer.title,
      companyName: offer.companyName,
      date: offer.interviewAt as Date,
    })),
    expiredOfferCount,
  });
  const channel = digest
    ? await sendUserNotificationEmail({
        userId: user.id,
        to: user.email,
        subject: digest.subject,
        text: digest.text,
      })
    : null;

  // Also recorded when nothing was sent, so the next digest starts from now.
  await db.userProfile.update({
    where: { userId: user.id },
    data: { lastDigestSentAt: now },
  });

  return channel;
}

async function sendDueDigests(now: Date, deadline: number) {
  const users = await db.user.findMany({
    where: {
      status: UserStatus.ACTIVE,
      profile: {
        dailyDigestEnabled: true,
        OR: [
          { lastDigestSentAt: null },
          { lastDigestSentAt: { lt: new Date(now.getTime() - DIGEST_INTERVAL_MS) } },
        ],
      },
      OR: [
        {
          jobs: {
            none: {
              type: AppJobType.SEARCH_DISCOVERY_RUN,
              status: { in: ACTIVE_SEARCH_JOB_STATUSES },
            },
          },
        },
        { profile: { lastDigestSentAt: { lt: new Date(now.getTime() - DIGEST_MAX_WAIT_MS) } } },
      ],
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      profile: { select: { lastDigestSentAt: true } },
    },
    take: MAX_DIGESTS_PER_RUN,
  });
  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    if (remainingMs(deadline) < MIN_TIME_FOR_DIGEST_MS) {
      break;
    }

    try {
      const channel = await sendDigestForUser(
        {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          lastDigestSentAt: user.profile?.lastDigestSentAt ?? null,
        },
        now,
      );

      if (channel) {
        sent += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      logServiceError({
        scope: "alerts/daily-digest",
        message: "Daily digest failed for user",
        error,
        metadata: { userId: user.id },
      });
    }
  }

  return { sent, skipped };
}

// Each call does one bounded slice of work, so it can run from a daily Vercel
// cron and more often from any external scheduler without doing work twice.
export async function runScheduledMaintenance(options: { deadline: number }) {
  const now = new Date();
  const staleJobs = await releaseStaleAppJobs(STALE_JOB_AFTER_MS);
  const enqueuedSearches = await enqueueDueSearches(now);
  const processedJobs = await runQueuedJobs(options.deadline);
  const availability = await checkFollowedOfferAvailability(now, options.deadline);
  const digests = await sendDueDigests(new Date(), options.deadline);
  const summary = {
    staleJobs,
    enqueuedSearches,
    processedJobs,
    availability,
    digests,
  };

  logServiceEvent({
    scope: "alerts/maintenance",
    message: "Scheduled maintenance completed",
    metadata: summary,
  });

  return summary;
}
