import { createHash } from "node:crypto";

import { db } from "@/lib/db";

export type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const EXPIRED_BUCKET_CLEANUP_PROBABILITY = 0.01;

export class RateLimitExceededError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many requests");
    this.name = "RateLimitExceededError";
  }
}

// Identifiers such as emails are hashed so the table never stores raw personal data.
export function buildRateLimitKey(scope: string, identifier: string) {
  return `${scope}:${createHash("sha256").update(identifier).digest("hex")}`;
}

// Fixed-window counter stored in Postgres so the limit holds across every
// serverless instance, unlike an in-memory counter.
export async function consumeRateLimit(rule: RateLimitRule): Promise<RateLimitResult> {
  const windowSeconds = Math.ceil(rule.windowMs / 1000);
  const [bucket] = await db.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${rule.key}, 1, NOW() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN NOW() + make_interval(secs => ${windowSeconds})
        ELSE "RateLimitBucket"."resetAt"
      END
    RETURNING "count", "resetAt"
  `;

  if (Math.random() < EXPIRED_BUCKET_CLEANUP_PROBABILITY) {
    await deleteExpiredRateLimitBuckets();
  }

  if (!bucket) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: bucket.count <= rule.limit,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((bucket.resetAt.getTime() - Date.now()) / 1000),
    ),
  };
}

export async function enforceRateLimits(rules: RateLimitRule[]) {
  for (const rule of rules) {
    const result = await consumeRateLimit(rule);

    if (!result.allowed) {
      throw new RateLimitExceededError(result.retryAfterSeconds);
    }
  }
}

export async function deleteExpiredRateLimitBuckets() {
  await db.rateLimitBucket.deleteMany({
    where: {
      resetAt: {
        lte: new Date(),
      },
    },
  });
}

export function buildRateLimitResponseInit(error: RateLimitExceededError) {
  return {
    status: 429,
    headers: {
      "Retry-After": String(error.retryAfterSeconds),
    },
  };
}
