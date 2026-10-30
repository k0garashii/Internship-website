-- CreateEnum
CREATE TYPE "DraftKind" AS ENUM ('APPLICATION', 'FOLLOW_UP', 'COVER_LETTER');

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastDigestSentAt" TIMESTAMP(3),
ADD COLUMN     "resumeFileName" TEXT,
ADD COLUMN     "resumeText" TEXT,
ADD COLUMN     "resumeUploadedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "JobOffer" ADD COLUMN     "availabilityCheckedAt" TIMESTAMP(3),
ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "interviewAt" TIMESTAMP(3),
ADD COLUMN     "nextFollowUpAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EmailDraft" ADD COLUMN     "kind" "DraftKind" NOT NULL DEFAULT 'APPLICATION';

-- CreateIndex
CREATE INDEX "JobOffer_userId_nextFollowUpAt_idx" ON "JobOffer"("userId", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "JobOffer_availabilityCheckedAt_idx" ON "JobOffer"("availabilityCheckedAt");

