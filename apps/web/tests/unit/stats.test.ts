import assert from "node:assert/strict";
import test from "node:test";

import { resolveStageTimestamps } from "../../src/lib/applications/pipeline";
import { isDeveloperEmail } from "../../src/lib/auth/developers";
import { computeSearchStats, startOfWeek, STATS_WEEK_COUNT } from "../../src/lib/stats/search-stats";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-31T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);

test("weeks start on Monday", () => {
  assert.equal(startOfWeek(now).toISOString(), "2026-10-26T00:00:00.000Z");
  assert.equal(startOfWeek(new Date("2026-10-26T00:00:00Z")).toISOString(), "2026-10-26T00:00:00.000Z");
});

test("search stats count funnel, rates, delays, weeks and sources", () => {
  const stats = computeSearchStats(
    [
      { sourceSite: "WTTJ", firstSeenAt: daysAgo(1), appliedAt: null, respondedAt: null, latestDecision: null },
      { sourceSite: "WTTJ", firstSeenAt: daysAgo(2), appliedAt: null, respondedAt: null, latestDecision: "FAVORITE" },
      { sourceSite: "WTTJ", firstSeenAt: daysAgo(20), appliedAt: daysAgo(15), respondedAt: daysAgo(10), latestDecision: "INTERVIEWING" },
      { sourceSite: "Indeed", firstSeenAt: daysAgo(30), appliedAt: daysAgo(25), respondedAt: daysAgo(22), latestDecision: "REJECTED" },
      { sourceSite: "Indeed", firstSeenAt: daysAgo(3), appliedAt: daysAgo(2), respondedAt: null, latestDecision: "APPLIED" },
      { sourceSite: "Indeed", firstSeenAt: daysAgo(400), appliedAt: null, respondedAt: null, latestDecision: "NOT_RELEVANT" },
    ],
    now,
  );

  assert.deepEqual(stats.totals, {
    discovered: 6,
    kept: 4,
    applied: 3,
    responded: 2,
    interviews: 1,
    accepted: 0,
    rejected: 1,
  });
  assert.equal(stats.rates.responseRate, 2 / 3);
  assert.equal(stats.rates.interviewRate, 1 / 3);
  assert.equal(stats.medianResponseDays, 4);
  assert.equal(stats.weekly.length, STATS_WEEK_COUNT);
  assert.equal(stats.weekly.reduce((sum, week) => sum + week.discovered, 0), 5);
  assert.equal(stats.weekly.at(-1)?.discovered, 3);
  assert.equal(stats.sources[0]?.sourceSite, "Indeed");
  assert.deepEqual(
    stats.sources.map((source) => [source.sourceSite, source.applied, source.responded]),
    [
      ["Indeed", 2, 1],
      ["WTTJ", 1, 1],
    ],
  );
});

test("empty history gives no rates instead of zero divisions", () => {
  const stats = computeSearchStats([], now);

  assert.equal(stats.rates.responseRate, null);
  assert.equal(stats.medianResponseDays, null);
  assert.equal(stats.sources.length, 0);
});

test("stage timestamps keep the first send and answer dates", () => {
  const applied = new Date("2026-10-01T00:00:00Z");
  const answered = new Date("2026-10-05T00:00:00Z");

  assert.deepEqual(resolveStageTimestamps({ stage: "APPLIED", appliedAt: null, respondedAt: null, now }), {
    appliedAt: now,
    respondedAt: null,
  });
  assert.deepEqual(
    resolveStageTimestamps({ stage: "INTERVIEWING", appliedAt: applied, respondedAt: null, now }),
    { appliedAt: applied, respondedAt: now },
  );
  assert.deepEqual(
    resolveStageTimestamps({ stage: "REJECTED", appliedAt: applied, respondedAt: answered, now }),
    { appliedAt: applied, respondedAt: answered },
  );
  assert.deepEqual(
    resolveStageTimestamps({ stage: "FAVORITE", appliedAt: applied, respondedAt: answered, now }),
    { appliedAt: null, respondedAt: null },
  );
});

test("developer accounts come from DEVELOPER_EMAILS only", () => {
  const previous = process.env.DEVELOPER_EMAILS;
  process.env.DEVELOPER_EMAILS = " Dev@Example.com , other@example.com";

  assert.equal(isDeveloperEmail("dev@example.com"), true);
  assert.equal(isDeveloperEmail("someone@example.com"), false);
  assert.equal(isDeveloperEmail(null), false);

  process.env.DEVELOPER_EMAILS = "";
  assert.equal(isDeveloperEmail("dev@example.com"), false);

  process.env.DEVELOPER_EMAILS = previous;
});
