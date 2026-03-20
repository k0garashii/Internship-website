import type { SearchRunStatus } from "@prisma/client";

import { db } from "@/lib/db";
import type { SearchHistoryEntry, SearchHistoryResult } from "@/lib/search/types";

export class SearchHistoryError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SearchHistoryError";
  }
}

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

function mapSearchRunStatus(status: SearchRunStatus): SearchHistoryEntry["status"] {
  return status;
}

function buildHistorySummary(runCount: number) {
  if (runCount === 0) {
    return "Aucune recherche n a encore ete lancee.";
  }

  return `${runCount} recherche(s) historisee(s) disponibles.`;
}

export async function listSearchHistoryForUser(
  userId: string,
  limit = 12,
): Promise<SearchHistoryResult> {
  const runs = await db.searchRun.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    select: {
      id: true,
      label: true,
      status: true,
      queryText: true,
      resultCount: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      errorMessage: true,
      searchMatches: {
        orderBy: [
          {
            rank: "asc",
          },
          {
            discoveredAt: "asc",
          },
        ],
        take: 3,
        select: {
          rank: true,
          rawScore: true,
          jobOffer: {
            select: {
              id: true,
              title: true,
              companyName: true,
              sourceUrl: true,
            },
          },
        },
      },
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: buildHistorySummary(runs.length),
    runCount: runs.length,
    runs: runs.map((run) => ({
      id: run.id,
      label: run.label,
      status: mapSearchRunStatus(run.status),
      queryText: run.queryText,
      resultCount: run.resultCount,
      startedAt: toIsoString(run.startedAt),
      completedAt: toIsoString(run.completedAt),
      createdAt: run.createdAt.toISOString(),
      errorMessage: run.errorMessage,
      topOffers: run.searchMatches.map((match) => ({
        jobOfferId: match.jobOffer.id,
        title: match.jobOffer.title,
        companyName: match.jobOffer.companyName,
        sourceUrl: match.jobOffer.sourceUrl,
        rank: match.rank,
        matchScore: typeof match.rawScore === "number" ? Math.round(match.rawScore) : null,
      })),
    })),
  };
}
