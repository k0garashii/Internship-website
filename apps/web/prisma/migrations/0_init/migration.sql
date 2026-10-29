-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'PENDING_DELETION');

-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'TEAM');

-- CreateEnum
CREATE TYPE "WorkspaceMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'BILLING');

-- CreateEnum
CREATE TYPE "WorkspaceInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('INTERNAL', 'STRIPE', 'LEMONSQUEEZY');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WorkspaceFeature" AS ENUM ('SEARCH_DISCOVERY', 'EMAIL_DRAFT_GENERATION', 'EMAIL_GMAIL_SYNC', 'EMAIL_GMAIL_SEND', 'COMPANY_TARGETING', 'PROFILE_ENRICHMENT', 'API_ACCESS');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('PLAN', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "AppJobType" AS ENUM ('PROFILE_ENRICHMENT_REFRESH', 'SEARCH_DISCOVERY_RUN', 'GMAIL_SYNC');

-- CreateEnum
CREATE TYPE "AppJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('INTERN', 'ENTRY_LEVEL', 'JUNIOR', 'MID', 'SENIOR', 'LEAD');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('INTERNSHIP', 'APPRENTICESHIP', 'FULL_TIME', 'PART_TIME', 'TEMPORARY', 'FREELANCE');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "DomainSource" AS ENUM ('MANUAL', 'GEMINI', 'IMPORTED');

-- CreateEnum
CREATE TYPE "TargetSource" AS ENUM ('MANUAL', 'GEMINI', 'IMPORTED');

-- CreateEnum
CREATE TYPE "SearchRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "OfferSourceKind" AS ENUM ('COMPANY_CAREERS', 'JOB_BOARD', 'AGENCY', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "OfferLifecycleStatus" AS ENUM ('DISCOVERED', 'NORMALIZED', 'SCORED', 'SHORTLISTED', 'APPLIED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FeedbackDecision" AS ENUM ('NOT_RELEVANT', 'MAYBE', 'FAVORITE', 'APPLIED', 'INTERVIEWING', 'REJECTED', 'OFFER_ACCEPTED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'SENT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmailIngestionSourceType" AS ENUM ('FORWARDING', 'GMAIL', 'OUTLOOK');

-- CreateEnum
CREATE TYPE "EmailIngestionConnectionStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "MailboxMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MailboxReplyStatus" AS ENUM ('NONE', 'OUTBOUND_ONLY', 'RESPONSE_RECEIVED', 'INTERVIEW', 'REJECTION', 'OFFER');

-- CreateEnum
CREATE TYPE "InboundEmailStatus" AS ENUM ('RECEIVED', 'PARSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailDeliveryLogStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailDeliveryOperation" AS ENUM ('GMAIL_DRAFT', 'GMAIL_SEND', 'ADHOC_GMAIL_SEND');

-- CreateEnum
CREATE TYPE "InboundEmailSignal" AS ENUM ('UNKNOWN', 'JOB_ALERT', 'CAREER_SITE_DIGEST', 'RECRUITER_OUTREACH', 'SCHOOL_CAREER_DIGEST', 'APPLICATION_UPDATE');

-- CreateEnum
CREATE TYPE "ProfileEnrichmentStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "SearchPreferenceAxis" AS ENUM ('ROLE', 'DOMAIN', 'KEYWORD', 'TECHNOLOGY', 'LOCATION', 'WORK_MODE', 'EMPLOYMENT_TYPE', 'COMPANY', 'COMPANY_TYPE', 'OUTCOME');

-- CreateEnum
CREATE TYPE "SearchPreferencePolarity" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "SearchPreferenceConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SearchSignalStrength" AS ENUM ('WEAK', 'MEDIUM', 'STRONG', 'OUTCOME');

-- CreateEnum
CREATE TYPE "SearchBehaviorEventType" AS ENUM ('SEARCH_PLAN_VIEWED', 'SEARCH_EXECUTED', 'SEARCH_RESULT_OPENED', 'SEARCH_RESULT_EXPANDED', 'COMPANY_TARGET_OPENED', 'ATS_SOURCE_OPENED', 'OFFER_SAVED', 'OFFER_DELETED', 'OFFER_FEEDBACK_FAVORITE', 'OFFER_FEEDBACK_MAYBE', 'OFFER_FEEDBACK_NOT_RELEVANT', 'DRAFT_GENERATED', 'EMAIL_SENT', 'EMAIL_REPLY_RECEIVED', 'INTERVIEW_RECORDED', 'REJECTION_RECORDED', 'OFFER_ACCEPTED_RECORDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "fullName" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr-FR',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "activeWorkspaceId" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkspaceType" NOT NULL DEFAULT 'PERSONAL',
    "createdByUserId" TEXT,
    "personalOwnerUserId" TEXT,
    "defaultLocale" TEXT NOT NULL DEFAULT 'fr-FR',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceMemberRole" NOT NULL DEFAULT 'MEMBER',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "role" "WorkspaceMemberRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" "WorkspaceInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'INTERNAL',
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "featureMatrix" JSONB NOT NULL,
    "externalProductId" TEXT,
    "externalPriceId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'INTERNAL',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "externalSubscriptionId" TEXT,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceEntitlement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "feature" "WorkspaceFeature" NOT NULL,
    "source" "EntitlementSource" NOT NULL DEFAULT 'OVERRIDE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limitValue" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "subscriptionId" TEXT,
    "provider" "BillingProvider" NOT NULL DEFAULT 'INTERNAL',
    "eventType" TEXT NOT NULL,
    "externalEventId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'oauth',
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "headline" TEXT,
    "summary" TEXT,
    "school" TEXT,
    "degree" TEXT,
    "graduationYear" INTEGER,
    "city" TEXT,
    "countryCode" TEXT,
    "remotePreference" "WorkMode",
    "experienceLevel" "ExperienceLevel",
    "availabilityDate" TIMESTAMP(3),
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "portfolioUrl" TEXT,
    "resumeUrl" TEXT,
    "visaNeedsSponsorship" BOOLEAN NOT NULL DEFAULT false,
    "salaryExpectationMin" INTEGER,
    "salaryExpectationMax" INTEGER,
    "constraints" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileSkill" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "level" "SkillLevel",
    "yearsExperience" INTEGER,
    "isHighlighted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyWatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "companyName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "careerPageUrl" TEXT,
    "notes" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyWatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchDomain" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "source" "DomainSource" NOT NULL DEFAULT 'MANUAL',
    "rationale" TEXT,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "source" "TargetSource" NOT NULL DEFAULT 'MANUAL',
    "experienceLevel" "ExperienceLevel",
    "contractTypes" "EmploymentType"[],
    "notes" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchLocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "countryCode" TEXT,
    "region" TEXT,
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "isHybrid" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "label" TEXT NOT NULL,
    "queryText" TEXT,
    "status" "SearchRunStatus" NOT NULL DEFAULT 'PENDING',
    "filtersSnapshot" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOffer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "sourceKind" "OfferSourceKind" NOT NULL,
    "sourceSite" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "externalId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyWebsite" TEXT,
    "title" TEXT NOT NULL,
    "locationLabel" TEXT,
    "countryCode" TEXT,
    "employmentType" "EmploymentType",
    "workMode" "WorkMode",
    "experienceLevel" "ExperienceLevel",
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "currency" TEXT,
    "description" TEXT,
    "rawPayload" JSONB,
    "status" "OfferLifecycleStatus" NOT NULL DEFAULT 'DISCOVERED',
    "postedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchRunOffer" (
    "id" TEXT NOT NULL,
    "searchRunId" TEXT NOT NULL,
    "jobOfferId" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rank" INTEGER,
    "rawScore" DOUBLE PRECISION,
    "normalizedScore" DOUBLE PRECISION,
    "matchExplanation" TEXT,
    "isShortlisted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SearchRunOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "jobOfferId" TEXT NOT NULL,
    "decision" "FeedbackDecision" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "jobOfferId" TEXT,
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "recipientEmail" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "personalizationSummary" TEXT,
    "generatedBy" TEXT,
    "deliveryProvider" TEXT,
    "gmailDraftId" TEXT,
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "contextSnapshot" JSONB,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDeliveryLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "emailDraftId" TEXT,
    "provider" TEXT NOT NULL,
    "operation" "EmailDeliveryOperation" NOT NULL,
    "status" "EmailDeliveryLogStatus" NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT,
    "bodyPreview" TEXT,
    "errorMessage" TEXT,
    "providerDraftId" TEXT,
    "providerMessageId" TEXT,
    "providerThreadId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailIngestionConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "authAccountId" TEXT,
    "sourceType" "EmailIngestionSourceType" NOT NULL,
    "label" TEXT NOT NULL,
    "status" "EmailIngestionConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "mailboxAddress" TEXT,
    "syncCursor" TEXT,
    "syncQuery" TEXT,
    "syncLabel" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "forwardingLocalPart" TEXT,
    "forwardingAddress" TEXT,
    "webhookSecretHash" TEXT,
    "lastIngestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailIngestionConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "connectionId" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "fromEmail" TEXT,
    "fromName" TEXT,
    "toEmail" TEXT,
    "subject" TEXT,
    "bodyPreview" TEXT,
    "snippet" TEXT,
    "canonicalUrl" TEXT,
    "signal" "InboundEmailSignal" NOT NULL DEFAULT 'UNKNOWN',
    "processingStatus" "InboundEmailStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailboxMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "connectionId" TEXT NOT NULL,
    "jobOfferId" TEXT,
    "providerMessageId" TEXT NOT NULL,
    "providerThreadId" TEXT,
    "direction" "MailboxMessageDirection" NOT NULL,
    "folderLabel" TEXT,
    "subject" TEXT,
    "normalizedSubject" TEXT,
    "snippet" TEXT,
    "fromEmail" TEXT,
    "fromName" TEXT,
    "toEmails" JSONB,
    "ccEmails" JSONB,
    "canonicalUrl" TEXT,
    "signal" "InboundEmailSignal" NOT NULL DEFAULT 'UNKNOWN',
    "processingStatus" "InboundEmailStatus" NOT NULL DEFAULT 'RECEIVED',
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferMailboxSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "jobOfferId" TEXT NOT NULL,
    "mailboxMessageId" TEXT,
    "providerThreadId" TEXT,
    "status" "MailboxReplyStatus" NOT NULL DEFAULT 'NONE',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "summary" TEXT,
    "details" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferMailboxSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfileEnrichment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "status" "ProfileEnrichmentStatus" NOT NULL DEFAULT 'PENDING',
    "sourceSnapshot" JSONB,
    "extractedData" JSONB,
    "summary" TEXT,
    "lastError" TEXT,
    "lastEnrichedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfileEnrichment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchBehaviorEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "type" "SearchBehaviorEventType" NOT NULL,
    "axisSummary" "SearchPreferenceAxis"[],
    "strength" "SearchSignalStrength" NOT NULL,
    "dedupeKey" TEXT,
    "queryText" TEXT,
    "companyName" TEXT,
    "companySlug" TEXT,
    "sourceUrl" TEXT,
    "jobOfferId" TEXT,
    "searchRunId" TEXT,
    "emailDraftId" TEXT,
    "mailboxMessageId" TEXT,
    "signalPayload" JSONB,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchBehaviorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSearchProfileInference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "declaredSnapshot" JSONB,
    "inferredSnapshot" JSONB,
    "diagnostics" JSONB,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" TIMESTAMP(3),
    "lastComputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSearchProfileInference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "type" "AppJobType" NOT NULL,
    "status" "AppJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "lockToken" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppJobRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "AppJobStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "output" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_activeWorkspaceId_idx" ON "User"("activeWorkspaceId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_personalOwnerUserId_key" ON "Workspace"("personalOwnerUserId");

-- CreateIndex
CREATE INDEX "Workspace_createdByUserId_idx" ON "Workspace"("createdByUserId");

-- CreateIndex
CREATE INDEX "Workspace_isArchived_idx" ON "Workspace"("isArchived");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_role_idx" ON "WorkspaceMember"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvitation_token_key" ON "WorkspaceInvitation"("token");

-- CreateIndex
CREATE INDEX "WorkspaceInvitation_workspaceId_status_idx" ON "WorkspaceInvitation"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvitation_workspaceId_normalizedEmail_status_key" ON "WorkspaceInvitation"("workspaceId", "normalizedEmail", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Plan_provider_isDefault_idx" ON "Plan"("provider", "isDefault");

-- CreateIndex
CREATE INDEX "WorkspaceSubscription_workspaceId_status_idx" ON "WorkspaceSubscription"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceSubscription_planId_idx" ON "WorkspaceSubscription"("planId");

-- CreateIndex
CREATE INDEX "WorkspaceEntitlement_workspaceId_enabled_idx" ON "WorkspaceEntitlement"("workspaceId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceEntitlement_workspaceId_feature_key" ON "WorkspaceEntitlement"("workspaceId", "feature");

-- CreateIndex
CREATE INDEX "BillingEvent_workspaceId_createdAt_idx" ON "BillingEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingEvent_subscriptionId_idx" ON "BillingEvent"("subscriptionId");

-- CreateIndex
CREATE INDEX "AuthAccount_userId_idx" ON "AuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_provider_providerAccountId_key" ON "AuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_sessionToken_key" ON "AuthSession"("sessionToken");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_workspaceId_idx" ON "UserProfile"("workspaceId");

-- CreateIndex
CREATE INDEX "ProfileSkill_profileId_idx" ON "ProfileSkill"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileSkill_profileId_normalizedName_key" ON "ProfileSkill"("profileId", "normalizedName");

-- CreateIndex
CREATE INDEX "CompanyWatchlistItem_userId_priority_idx" ON "CompanyWatchlistItem"("userId", "priority");

-- CreateIndex
CREATE INDEX "CompanyWatchlistItem_workspaceId_idx" ON "CompanyWatchlistItem"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyWatchlistItem_userId_normalizedName_key" ON "CompanyWatchlistItem"("userId", "normalizedName");

-- CreateIndex
CREATE INDEX "SearchDomain_userId_isValidated_idx" ON "SearchDomain"("userId", "isValidated");

-- CreateIndex
CREATE INDEX "SearchDomain_workspaceId_idx" ON "SearchDomain"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchDomain_userId_normalizedLabel_key" ON "SearchDomain"("userId", "normalizedLabel");

-- CreateIndex
CREATE INDEX "SearchTarget_userId_priority_idx" ON "SearchTarget"("userId", "priority");

-- CreateIndex
CREATE INDEX "SearchTarget_workspaceId_idx" ON "SearchTarget"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchTarget_userId_normalizedTitle_key" ON "SearchTarget"("userId", "normalizedTitle");

-- CreateIndex
CREATE INDEX "SearchLocation_userId_priority_idx" ON "SearchLocation"("userId", "priority");

-- CreateIndex
CREATE INDEX "SearchLocation_workspaceId_idx" ON "SearchLocation"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchLocation_userId_normalizedLabel_key" ON "SearchLocation"("userId", "normalizedLabel");

-- CreateIndex
CREATE INDEX "SearchRun_userId_status_idx" ON "SearchRun"("userId", "status");

-- CreateIndex
CREATE INDEX "SearchRun_userId_createdAt_idx" ON "SearchRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchRun_workspaceId_idx" ON "SearchRun"("workspaceId");

-- CreateIndex
CREATE INDEX "JobOffer_userId_status_idx" ON "JobOffer"("userId", "status");

-- CreateIndex
CREATE INDEX "JobOffer_userId_postedAt_idx" ON "JobOffer"("userId", "postedAt");

-- CreateIndex
CREATE INDEX "JobOffer_workspaceId_idx" ON "JobOffer"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "JobOffer_userId_fingerprint_key" ON "JobOffer"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "SearchRunOffer_jobOfferId_idx" ON "SearchRunOffer"("jobOfferId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchRunOffer_searchRunId_jobOfferId_key" ON "SearchRunOffer"("searchRunId", "jobOfferId");

-- CreateIndex
CREATE INDEX "OfferFeedback_userId_createdAt_idx" ON "OfferFeedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OfferFeedback_jobOfferId_decision_idx" ON "OfferFeedback"("jobOfferId", "decision");

-- CreateIndex
CREATE INDEX "OfferFeedback_workspaceId_idx" ON "OfferFeedback"("workspaceId");

-- CreateIndex
CREATE INDEX "EmailDraft_userId_status_idx" ON "EmailDraft"("userId", "status");

-- CreateIndex
CREATE INDEX "EmailDraft_jobOfferId_idx" ON "EmailDraft"("jobOfferId");

-- CreateIndex
CREATE INDEX "EmailDraft_workspaceId_idx" ON "EmailDraft"("workspaceId");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_userId_createdAt_idx" ON "EmailDeliveryLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_emailDraftId_idx" ON "EmailDeliveryLog"("emailDraftId");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_workspaceId_idx" ON "EmailDeliveryLog"("workspaceId");

-- CreateIndex
CREATE INDEX "EmailIngestionConnection_authAccountId_idx" ON "EmailIngestionConnection"("authAccountId");

-- CreateIndex
CREATE INDEX "EmailIngestionConnection_userId_status_idx" ON "EmailIngestionConnection"("userId", "status");

-- CreateIndex
CREATE INDEX "EmailIngestionConnection_workspaceId_idx" ON "EmailIngestionConnection"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailIngestionConnection_userId_sourceType_key" ON "EmailIngestionConnection"("userId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "EmailIngestionConnection_forwardingLocalPart_key" ON "EmailIngestionConnection"("forwardingLocalPart");

-- CreateIndex
CREATE INDEX "InboundEmail_userId_receivedAt_idx" ON "InboundEmail"("userId", "receivedAt");

-- CreateIndex
CREATE INDEX "InboundEmail_connectionId_processingStatus_idx" ON "InboundEmail"("connectionId", "processingStatus");

-- CreateIndex
CREATE INDEX "InboundEmail_workspaceId_idx" ON "InboundEmail"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_connectionId_externalMessageId_key" ON "InboundEmail"("connectionId", "externalMessageId");

-- CreateIndex
CREATE INDEX "MailboxMessage_userId_providerThreadId_idx" ON "MailboxMessage"("userId", "providerThreadId");

-- CreateIndex
CREATE INDEX "MailboxMessage_jobOfferId_receivedAt_idx" ON "MailboxMessage"("jobOfferId", "receivedAt");

-- CreateIndex
CREATE INDEX "MailboxMessage_connectionId_sentAt_idx" ON "MailboxMessage"("connectionId", "sentAt");

-- CreateIndex
CREATE INDEX "MailboxMessage_connectionId_receivedAt_idx" ON "MailboxMessage"("connectionId", "receivedAt");

-- CreateIndex
CREATE INDEX "MailboxMessage_connectionId_processingStatus_idx" ON "MailboxMessage"("connectionId", "processingStatus");

-- CreateIndex
CREATE INDEX "MailboxMessage_workspaceId_idx" ON "MailboxMessage"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "MailboxMessage_connectionId_providerMessageId_key" ON "MailboxMessage"("connectionId", "providerMessageId");

-- CreateIndex
CREATE INDEX "OfferMailboxSignal_jobOfferId_status_idx" ON "OfferMailboxSignal"("jobOfferId", "status");

-- CreateIndex
CREATE INDEX "OfferMailboxSignal_userId_detectedAt_idx" ON "OfferMailboxSignal"("userId", "detectedAt");

-- CreateIndex
CREATE INDEX "OfferMailboxSignal_workspaceId_idx" ON "OfferMailboxSignal"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferMailboxSignal_userId_jobOfferId_key" ON "OfferMailboxSignal"("userId", "jobOfferId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfileEnrichment_userId_key" ON "UserProfileEnrichment"("userId");

-- CreateIndex
CREATE INDEX "UserProfileEnrichment_status_lastEnrichedAt_idx" ON "UserProfileEnrichment"("status", "lastEnrichedAt");

-- CreateIndex
CREATE INDEX "UserProfileEnrichment_workspaceId_idx" ON "UserProfileEnrichment"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchBehaviorEvent_dedupeKey_key" ON "SearchBehaviorEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "SearchBehaviorEvent_userId_occurredAt_idx" ON "SearchBehaviorEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "SearchBehaviorEvent_workspaceId_occurredAt_idx" ON "SearchBehaviorEvent"("workspaceId", "occurredAt");

-- CreateIndex
CREATE INDEX "SearchBehaviorEvent_type_occurredAt_idx" ON "SearchBehaviorEvent"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "SearchBehaviorEvent_jobOfferId_idx" ON "SearchBehaviorEvent"("jobOfferId");

-- CreateIndex
CREATE INDEX "SearchBehaviorEvent_searchRunId_idx" ON "SearchBehaviorEvent"("searchRunId");

-- CreateIndex
CREATE INDEX "SearchBehaviorEvent_emailDraftId_idx" ON "SearchBehaviorEvent"("emailDraftId");

-- CreateIndex
CREATE INDEX "SearchBehaviorEvent_mailboxMessageId_idx" ON "SearchBehaviorEvent"("mailboxMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSearchProfileInference_userId_key" ON "UserSearchProfileInference"("userId");

-- CreateIndex
CREATE INDEX "UserSearchProfileInference_workspaceId_lastComputedAt_idx" ON "UserSearchProfileInference"("workspaceId", "lastComputedAt");

-- CreateIndex
CREATE INDEX "AppJob_status_availableAt_idx" ON "AppJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "AppJob_type_status_idx" ON "AppJob"("type", "status");

-- CreateIndex
CREATE INDEX "AppJob_workspaceId_idx" ON "AppJob"("workspaceId");

-- CreateIndex
CREATE INDEX "AppJob_userId_idx" ON "AppJob"("userId");

-- CreateIndex
CREATE INDEX "AppJobRun_jobId_createdAt_idx" ON "AppJobRun"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeWorkspaceId_fkey" FOREIGN KEY ("activeWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceSubscription" ADD CONSTRAINT "WorkspaceSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceSubscription" ADD CONSTRAINT "WorkspaceSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceEntitlement" ADD CONSTRAINT "WorkspaceEntitlement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WorkspaceSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSkill" ADD CONSTRAINT "ProfileSkill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyWatchlistItem" ADD CONSTRAINT "CompanyWatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyWatchlistItem" ADD CONSTRAINT "CompanyWatchlistItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchDomain" ADD CONSTRAINT "SearchDomain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchDomain" ADD CONSTRAINT "SearchDomain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchTarget" ADD CONSTRAINT "SearchTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchTarget" ADD CONSTRAINT "SearchTarget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchLocation" ADD CONSTRAINT "SearchLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchLocation" ADD CONSTRAINT "SearchLocation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRun" ADD CONSTRAINT "SearchRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRun" ADD CONSTRAINT "SearchRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRunOffer" ADD CONSTRAINT "SearchRunOffer_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "JobOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRunOffer" ADD CONSTRAINT "SearchRunOffer_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "SearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferFeedback" ADD CONSTRAINT "OfferFeedback_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "JobOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferFeedback" ADD CONSTRAINT "OfferFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferFeedback" ADD CONSTRAINT "OfferFeedback_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "JobOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryLog" ADD CONSTRAINT "EmailDeliveryLog_emailDraftId_fkey" FOREIGN KEY ("emailDraftId") REFERENCES "EmailDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryLog" ADD CONSTRAINT "EmailDeliveryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryLog" ADD CONSTRAINT "EmailDeliveryLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailIngestionConnection" ADD CONSTRAINT "EmailIngestionConnection_authAccountId_fkey" FOREIGN KEY ("authAccountId") REFERENCES "AuthAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailIngestionConnection" ADD CONSTRAINT "EmailIngestionConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailIngestionConnection" ADD CONSTRAINT "EmailIngestionConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "EmailIngestionConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxMessage" ADD CONSTRAINT "MailboxMessage_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "EmailIngestionConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxMessage" ADD CONSTRAINT "MailboxMessage_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "JobOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxMessage" ADD CONSTRAINT "MailboxMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxMessage" ADD CONSTRAINT "MailboxMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferMailboxSignal" ADD CONSTRAINT "OfferMailboxSignal_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "JobOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferMailboxSignal" ADD CONSTRAINT "OfferMailboxSignal_mailboxMessageId_fkey" FOREIGN KEY ("mailboxMessageId") REFERENCES "MailboxMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferMailboxSignal" ADD CONSTRAINT "OfferMailboxSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferMailboxSignal" ADD CONSTRAINT "OfferMailboxSignal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileEnrichment" ADD CONSTRAINT "UserProfileEnrichment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileEnrichment" ADD CONSTRAINT "UserProfileEnrichment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchBehaviorEvent" ADD CONSTRAINT "SearchBehaviorEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchBehaviorEvent" ADD CONSTRAINT "SearchBehaviorEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchBehaviorEvent" ADD CONSTRAINT "SearchBehaviorEvent_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "JobOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchBehaviorEvent" ADD CONSTRAINT "SearchBehaviorEvent_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "SearchRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchBehaviorEvent" ADD CONSTRAINT "SearchBehaviorEvent_emailDraftId_fkey" FOREIGN KEY ("emailDraftId") REFERENCES "EmailDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchBehaviorEvent" ADD CONSTRAINT "SearchBehaviorEvent_mailboxMessageId_fkey" FOREIGN KEY ("mailboxMessageId") REFERENCES "MailboxMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSearchProfileInference" ADD CONSTRAINT "UserSearchProfileInference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSearchProfileInference" ADD CONSTRAINT "UserSearchProfileInference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppJob" ADD CONSTRAINT "AppJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppJob" ADD CONSTRAINT "AppJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppJobRun" ADD CONSTRAINT "AppJobRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AppJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

