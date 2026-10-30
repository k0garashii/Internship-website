import { FeedbackDecision, OfferLifecycleStatus } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import type { SearchBehaviorEventType } from "@/lib/profile/personalization-signals";
import {
  buildSignalsFromOfferRecord,
  recordSearchBehaviorEvent,
} from "@/server/application/personalization/search-behavior-service";
import { getRequiredActiveWorkspaceIdForUser } from "@/server/application/workspace/workspace-service";

export const APPLICATION_STAGES = [
  "FAVORITE",
  "APPLIED",
  "INTERVIEWING",
  "OFFER_ACCEPTED",
  "REJECTED",
] as const;

export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const DEFAULT_FOLLOW_UP_DELAY_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const STAGE_EVENT_TYPES: Partial<Record<ApplicationStage, SearchBehaviorEventType>> = {
  FAVORITE: "OFFER_FEEDBACK_FAVORITE",
  INTERVIEWING: "INTERVIEW_RECORDED",
  REJECTED: "REJECTION_RECORDED",
  OFFER_ACCEPTED: "OFFER_ACCEPTED_RECORDED",
};

const nullableDateTimeSchema = z
  .union([z.string().trim(), z.null()])
  .transform((value) => (value ? new Date(value) : null))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), "Invalid date");

const applicationUpdateSchema = z
  .object({
    stage: z.enum(APPLICATION_STAGES).optional(),
    interviewAt: nullableDateTimeSchema.optional(),
    nextFollowUpAt: nullableDateTimeSchema.optional(),
  })
  .refine(
    (value) =>
      value.stage !== undefined ||
      value.interviewAt !== undefined ||
      value.nextFollowUpAt !== undefined,
    "Nothing to update",
  );

export class ApplicationUpdateError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApplicationUpdateError";
  }
}

export type ApplicationCard = {
  offerId: string;
  stage: ApplicationStage;
  title: string;
  companyName: string;
  locationLabel: string | null;
  sourceUrl: string;
  stageUpdatedAt: string;
  interviewAt: string | null;
  nextFollowUpAt: string | null;
  expiredAt: string | null;
  draftCounts: {
    application: number;
    followUp: number;
    coverLetter: number;
  };
};

function isApplicationStage(value: string): value is ApplicationStage {
  return (APPLICATION_STAGES as readonly string[]).includes(value);
}

// Follow-ups only make sense while waiting for an answer: entering "applied"
// schedules one, any later stage clears it unless a date is given explicitly.
export function resolveFollowUpDate(options: {
  stage: ApplicationStage | undefined;
  requested: Date | null | undefined;
  current: Date | null;
  now: Date;
}) {
  if (options.requested !== undefined) {
    return options.requested;
  }

  if (options.stage === "APPLIED") {
    return options.current ?? new Date(options.now.getTime() + DEFAULT_FOLLOW_UP_DELAY_DAYS * DAY_MS);
  }

  if (options.stage && options.stage !== "FAVORITE") {
    return null;
  }

  return options.current;
}

export async function listApplicationsForUser(userId: string): Promise<ApplicationCard[]> {
  const offers = await db.jobOffer.findMany({
    where: {
      userId,
      feedbackEntries: {
        some: {
          decision: { in: [...APPLICATION_STAGES] },
        },
      },
    },
    select: {
      id: true,
      title: true,
      companyName: true,
      locationLabel: true,
      sourceUrl: true,
      interviewAt: true,
      nextFollowUpAt: true,
      expiredAt: true,
      feedbackEntries: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { decision: true, updatedAt: true },
      },
      drafts: {
        select: { kind: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  return offers.flatMap((offer) => {
    const latest = offer.feedbackEntries[0];

    if (!latest || !isApplicationStage(latest.decision)) {
      return [];
    }

    return [
      {
        offerId: offer.id,
        stage: latest.decision,
        title: offer.title,
        companyName: offer.companyName,
        locationLabel: offer.locationLabel,
        sourceUrl: offer.sourceUrl,
        stageUpdatedAt: latest.updatedAt.toISOString(),
        interviewAt: offer.interviewAt?.toISOString() ?? null,
        nextFollowUpAt: offer.nextFollowUpAt?.toISOString() ?? null,
        expiredAt: offer.expiredAt?.toISOString() ?? null,
        draftCounts: {
          application: offer.drafts.filter((draft) => draft.kind === "APPLICATION").length,
          followUp: offer.drafts.filter((draft) => draft.kind === "FOLLOW_UP").length,
          coverLetter: offer.drafts.filter((draft) => draft.kind === "COVER_LETTER").length,
        },
      },
    ];
  });
}

export async function updateApplicationForUser(
  userId: string,
  offerId: string,
  input: unknown,
) {
  const parsed = applicationUpdateSchema.safeParse(input);

  if (!parsed.success) {
    throw new ApplicationUpdateError("Invalid application update", 400);
  }

  const offer = await db.jobOffer.findFirst({
    where: { id: offerId, userId },
    select: {
      id: true,
      title: true,
      companyName: true,
      locationLabel: true,
      employmentType: true,
      workMode: true,
      sourceUrl: true,
      rawPayload: true,
      nextFollowUpAt: true,
    },
  });

  if (!offer) {
    throw new ApplicationUpdateError("Offer not found", 404);
  }

  const { stage, interviewAt } = parsed.data;
  const workspaceId = await getRequiredActiveWorkspaceIdForUser(userId);
  const nextFollowUpAt = resolveFollowUpDate({
    stage,
    requested: parsed.data.nextFollowUpAt,
    current: offer.nextFollowUpAt,
    now: new Date(),
  });

  await db.$transaction(async (tx) => {
    if (stage) {
      const latest = await tx.offerFeedback.findFirst({
        where: { userId, jobOfferId: offerId },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });

      if (latest) {
        await tx.offerFeedback.update({
          where: { id: latest.id },
          data: { decision: FeedbackDecision[stage] },
        });
      } else {
        await tx.offerFeedback.create({
          data: { userId, workspaceId, jobOfferId: offerId, decision: FeedbackDecision[stage] },
        });
      }
    }

    await tx.jobOffer.update({
      where: { id: offerId },
      data: {
        nextFollowUpAt,
        ...(interviewAt !== undefined ? { interviewAt } : {}),
        ...(stage === "FAVORITE" ? { status: OfferLifecycleStatus.SHORTLISTED } : {}),
        ...(stage && stage !== "FAVORITE" ? { status: OfferLifecycleStatus.APPLIED } : {}),
      },
    });
  });

  const eventType = stage ? STAGE_EVENT_TYPES[stage] : undefined;

  if (eventType) {
    await recordSearchBehaviorEvent(
      { userId, workspaceId },
      {
        type: eventType,
        jobOfferId: offer.id,
        companyName: offer.companyName,
        sourceUrl: offer.sourceUrl,
        // A rejection comes from the employer: it does not make the offer's
        // traits less relevant to the user, so offer signals stay positive.
        signals: buildSignalsFromOfferRecord(offer),
        metadata: { source: "applications-pipeline" },
      },
    );
  }

  const cards = await listApplicationsForUser(userId);

  return cards.find((card) => card.offerId === offerId) ?? null;
}

// Sending an application email through the app moves the offer to "applied"
// unless the user already tracked a later stage.
export async function markApplicationSent(userId: string, offerId: string) {
  const latest = await db.offerFeedback.findFirst({
    where: { userId, jobOfferId: offerId },
    orderBy: { updatedAt: "desc" },
    select: { decision: true },
  });
  const laterStages: FeedbackDecision[] = [
    FeedbackDecision.APPLIED,
    FeedbackDecision.INTERVIEWING,
    FeedbackDecision.OFFER_ACCEPTED,
    FeedbackDecision.REJECTED,
  ];

  if (latest && laterStages.includes(latest.decision)) {
    return;
  }

  await updateApplicationForUser(userId, offerId, { stage: "APPLIED" });
}
