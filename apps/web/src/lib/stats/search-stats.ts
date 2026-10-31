const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
export const STATS_WEEK_COUNT = 8;

const KEPT_DECISIONS = new Set(["FAVORITE", "APPLIED", "INTERVIEWING", "OFFER_ACCEPTED", "REJECTED"]);
const INTERVIEW_DECISIONS = new Set(["INTERVIEWING", "OFFER_ACCEPTED"]);

export type StatsOfferRow = {
  sourceSite: string;
  firstSeenAt: Date;
  appliedAt: Date | null;
  respondedAt: Date | null;
  latestDecision: string | null;
};

export type SourceStats = {
  sourceSite: string;
  discovered: number;
  kept: number;
  applied: number;
  responded: number;
  interviews: number;
};

export type WeeklyStats = {
  weekStart: Date;
  discovered: number;
  applied: number;
};

export type SearchStats = {
  totals: {
    discovered: number;
    kept: number;
    applied: number;
    responded: number;
    interviews: number;
    accepted: number;
    rejected: number;
  };
  rates: {
    keptRate: number | null;
    responseRate: number | null;
    interviewRate: number | null;
  };
  medianResponseDays: number | null;
  weekly: WeeklyStats[];
  sources: SourceStats[];
};

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

// Weeks start on Monday 00:00 UTC, which is close enough to local time for a
// weekly activity view.
export function startOfWeek(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;

  return new Date(start.getTime() - daysSinceMonday * DAY_MS);
}

export function computeSearchStats(rows: StatsOfferRow[], now: Date): SearchStats {
  const firstWeek = new Date(startOfWeek(now).getTime() - (STATS_WEEK_COUNT - 1) * WEEK_MS);
  const weekly: WeeklyStats[] = Array.from({ length: STATS_WEEK_COUNT }, (_, index) => ({
    weekStart: new Date(firstWeek.getTime() + index * WEEK_MS),
    discovered: 0,
    applied: 0,
  }));
  const weekIndex = (date: Date) => Math.floor((date.getTime() - firstWeek.getTime()) / WEEK_MS);
  const sources = new Map<string, SourceStats>();
  const responseDelays: number[] = [];
  const totals = {
    discovered: rows.length,
    kept: 0,
    applied: 0,
    responded: 0,
    interviews: 0,
    accepted: 0,
    rejected: 0,
  };

  for (const row of rows) {
    const source = sources.get(row.sourceSite) ?? {
      sourceSite: row.sourceSite,
      discovered: 0,
      kept: 0,
      applied: 0,
      responded: 0,
      interviews: 0,
    };
    const isKept = row.latestDecision !== null && KEPT_DECISIONS.has(row.latestDecision);
    const isInterview = row.latestDecision !== null && INTERVIEW_DECISIONS.has(row.latestDecision);

    source.discovered += 1;
    source.kept += isKept ? 1 : 0;
    totals.kept += isKept ? 1 : 0;

    if (row.appliedAt) {
      source.applied += 1;
      totals.applied += 1;
    }

    if (row.appliedAt && row.respondedAt) {
      source.responded += 1;
      totals.responded += 1;
      responseDelays.push(Math.max(0, (row.respondedAt.getTime() - row.appliedAt.getTime()) / DAY_MS));
    }

    if (isInterview) {
      source.interviews += 1;
      totals.interviews += 1;
    }

    totals.accepted += row.latestDecision === "OFFER_ACCEPTED" ? 1 : 0;
    totals.rejected += row.latestDecision === "REJECTED" ? 1 : 0;
    sources.set(row.sourceSite, source);

    const discoveredWeek = weekIndex(row.firstSeenAt);

    if (discoveredWeek >= 0 && discoveredWeek < STATS_WEEK_COUNT) {
      weekly[discoveredWeek].discovered += 1;
    }

    if (row.appliedAt) {
      const appliedWeek = weekIndex(row.appliedAt);

      if (appliedWeek >= 0 && appliedWeek < STATS_WEEK_COUNT) {
        weekly[appliedWeek].applied += 1;
      }
    }
  }

  const medianDelay = median(responseDelays);

  return {
    totals,
    rates: {
      keptRate: ratio(totals.kept, totals.discovered),
      responseRate: ratio(totals.responded, totals.applied),
      interviewRate: ratio(totals.interviews, totals.applied),
    },
    medianResponseDays: medianDelay === null ? null : Math.round(medianDelay * 10) / 10,
    weekly,
    sources: [...sources.values()].sort(
      (left, right) =>
        right.applied - left.applied ||
        right.kept - left.kept ||
        right.discovered - left.discovered,
    ),
  };
}
