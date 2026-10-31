-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkspaceFeature" ADD VALUE 'AI_GENERATION';
ALTER TYPE "WorkspaceFeature" ADD VALUE 'EXTENDED_SOURCES';

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateTable
CREATE TABLE "FeatureUsage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "feature" "WorkspaceFeature" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureUsage_workspaceId_feature_periodStart_key" ON "FeatureUsage"("workspaceId", "feature", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_stripeCustomerId_key" ON "Workspace"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSubscription_externalSubscriptionId_key" ON "WorkspaceSubscription"("externalSubscriptionId");

-- AddForeignKey
ALTER TABLE "FeatureUsage" ADD CONSTRAINT "FeatureUsage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

