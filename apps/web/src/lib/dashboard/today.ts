import { FeedbackDecision } from "@prisma/client";

import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_INTERVIEW_DAYS = 7;
const LIST_LIMIT = 5;

export async function getTodaySummaryForUser(userId: string, now = new Date()) {
  const since = new Date(now.getTime() - DAY_MS);
  const [newOfferCount, newOffers, followUpsDue, upcomingInterviews] = await Promise.all([
    db.jobOffer.count({
      where: { userId, firstSeenAt: { gte: since }, expiredAt: null },
    }),
    db.jobOffer.findMany({
      where: {
        userId,
        firstSeenAt: { gte: since },
        expiredAt: null,
        feedbackEntries: { none: { decision: FeedbackDecision.NOT_RELEVANT } },
      },
      select: {
        id: true,
        title: true,
        companyName: true,
        searchMatches: {
          orderBy: { normalizedScore: "desc" },
          take: 1,
          select: { normalizedScore: true },
        },
      },
      take: 30,
    }),
    db.jobOffer.findMany({
      where: { userId, nextFollowUpAt: { lte: now } },
      select: { id: true, title: true, companyName: true, nextFollowUpAt: true },
      orderBy: { nextFollowUpAt: "asc" },
      take: LIST_LIMIT,
    }),
    db.jobOffer.findMany({
      where: {
        userId,
        interviewAt: { gte: now, lte: new Date(now.getTime() + UPCOMING_INTERVIEW_DAYS * DAY_MS) },
      },
      select: { id: true, title: true, companyName: true, interviewAt: true },
      orderBy: { interviewAt: "asc" },
      take: LIST_LIMIT,
    }),
  ]);

  return {
    newOfferCount,
    topNewOffers: newOffers
      .map((offer) => ({
        id: offer.id,
        title: offer.title,
        companyName: offer.companyName,
        scorePercent:
          offer.searchMatches[0]?.normalizedScore === undefined
            ? null
            : Math.round((offer.searchMatches[0].normalizedScore ?? 0) * 100),
      }))
      .sort((left, right) => (right.scorePercent ?? 0) - (left.scorePercent ?? 0))
      .slice(0, 3),
    followUpsDue: followUpsDue.map((offer) => ({
      id: offer.id,
      title: offer.title,
      companyName: offer.companyName,
    })),
    upcomingInterviews: upcomingInterviews.map((offer) => ({
      id: offer.id,
      title: offer.title,
      companyName: offer.companyName,
      interviewAt: offer.interviewAt as Date,
    })),
  };
}
