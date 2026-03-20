import { FeedbackDecision } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";

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

  return {
    id: feedback.id,
    decision: feedback.decision,
    note: feedback.note,
    updatedAt: feedback.updatedAt.toISOString(),
  };
}
