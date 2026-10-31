-- AlterTable
ALTER TABLE "JobOffer" ADD COLUMN     "appliedAt" TIMESTAMP(3),
ADD COLUMN     "respondedAt" TIMESTAMP(3);

-- Backfill from the latest feedback: its last update is the best known date
-- for applications tracked before these columns existed.
WITH latest AS (
  SELECT DISTINCT ON ("jobOfferId") "jobOfferId", "decision", "updatedAt"
  FROM "OfferFeedback"
  ORDER BY "jobOfferId", "updatedAt" DESC
)
UPDATE "JobOffer" AS o
SET "appliedAt" = latest."updatedAt",
    "respondedAt" = CASE
      WHEN latest."decision" IN ('INTERVIEWING', 'OFFER_ACCEPTED', 'REJECTED') THEN latest."updatedAt"
      ELSE NULL
    END
FROM latest
WHERE latest."jobOfferId" = o."id"
  AND latest."decision" IN ('APPLIED', 'INTERVIEWING', 'OFFER_ACCEPTED', 'REJECTED');
