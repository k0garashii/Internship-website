import { FeedbackDecision } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { buildSignalsFromOfferRecord, recordSearchBehaviorEvent } from "@/server/application/personalization/search-behavior-service";
import { getRequiredActiveWorkspaceIdForUser } from "@/server/application/workspace/workspace-service";

const offerFeedbackSchema = z.object({
  decision: z.enum(["NOT_RELEVANT", "MAYBE", "FAVORITE"]),
  note: z.string().trim().max(1000).optional(),
});

export type OfferFeedbackInput = z.infer<typeof offerFeedbackSchema>;

export class OfferFeedbackError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OfferFeedbackError";
  }
}

export async function saveOfferFeedback(
  userId: string,
  jobOfferId: string,
  input: unknown,
) {
  const workspaceId = await getRequiredActiveWorkspaceIdForUser(userId);
  const parsed = offerFeedbackSchema.safeParse(input);

  if (!parsed.success) {
    throw new OfferFeedbackError("Invalid feedback payload", 400);
  }

  const offer = await db.jobOffer.findFirst({
    where: {
      id: jobOfferId,
      userId,
    },
    select: {
      id: true,
      title: true,
      companyName: true,
      locationLabel: true,
      employmentType: true,
      workMode: true,
      sourceUrl: true,
      rawPayload: true,
    },
  });

  if (!offer) {
    throw new OfferFeedbackError("Offer not found", 404);
  }

  const existingFeedback = await db.offerFeedback.findFirst({
    where: {
      userId,
      jobOfferId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
    },
  });

  const feedback = existingFeedback
    ? await db.offerFeedback.update({
        where: {
          id: existingFeedback.id,
        },
        data: {
          decision: parsed.data.decision as FeedbackDecision,
          note: parsed.data.note?.trim() || null,
        },
        select: {
          id: true,
          decision: true,
          note: true,
          updatedAt: true,
        },
      })
    : await db.offerFeedback.create({
        data: {
          userId,
          workspaceId,
          jobOfferId,
          decision: parsed.data.decision as FeedbackDecision,
          note: parsed.data.note?.trim() || null,
        },
        select: {
          id: true,
          decision: true,
          note: true,
          updatedAt: true,
        },
      });

  await recordSearchBehaviorEvent(
    {
      userId,
      workspaceId,
    },
    {
      type:
        parsed.data.decision === "FAVORITE"
          ? "OFFER_FEEDBACK_FAVORITE"
          : parsed.data.decision === "MAYBE"
            ? "OFFER_FEEDBACK_MAYBE"
            : "OFFER_FEEDBACK_NOT_RELEVANT",
      jobOfferId: offer.id,
      companyName: offer.companyName,
      sourceUrl: offer.sourceUrl,
      signals: buildSignalsFromOfferRecord(offer).map((signal) => ({
        ...signal,
        polarity: parsed.data.decision === "NOT_RELEVANT" ? "NEGATIVE" : "POSITIVE",
      })),
      metadata: {
        note: parsed.data.note?.trim() || null,
        feedbackId: feedback.id,
      },
    },
  );

  return {
    id: feedback.id,
    decision: feedback.decision,
    note: feedback.note,
    updatedAt: feedback.updatedAt.toISOString(),
  };
}
