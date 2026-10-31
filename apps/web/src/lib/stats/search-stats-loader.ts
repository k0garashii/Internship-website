import { db } from "@/lib/db";
import { computeSearchStats } from "@/lib/stats/search-stats";

export async function getSearchStatsForUser(userId: string, now = new Date()) {
  const offers = await db.jobOffer.findMany({
    where: { userId },
    select: {
      sourceSite: true,
      firstSeenAt: true,
      appliedAt: true,
      respondedAt: true,
      feedbackEntries: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { decision: true },
      },
    },
  });

  return computeSearchStats(
    offers.map((offer) => ({
      sourceSite: offer.sourceSite,
      firstSeenAt: offer.firstSeenAt,
      appliedAt: offer.appliedAt,
      respondedAt: offer.respondedAt,
      latestDecision: offer.feedbackEntries[0]?.decision ?? null,
    })),
    now,
  );
}
