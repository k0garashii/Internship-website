import { z } from "zod";

import { db } from "@/lib/db";
import {
  readStringArrayConstraint,
  readStringConstraint,
} from "@/lib/profile/schema";

const candidateLinksSchema = z.object({
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  portfolioUrl: z.string().nullable(),
  resumeUrl: z.string().nullable(),
});

const offerGeminiCandidateSchema = z.object({
  fullName: z.string(),
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  school: z.string().nullable(),
  degree: z.string().nullable(),
  graduationYear: z.number().int().nullable(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  availabilityDate: z.string().nullable(),
  availabilityEndDate: z.string().nullable(),
  skills: z.array(z.string()),
  targetRoles: z.array(z.string()),
  preferredDomains: z.array(z.string()),
  preferredLocations: z.array(z.string()),
  searchKeywords: z.array(z.string()),
  employmentTypes: z.array(z.string()),
  preferencesNotes: z.string().nullable(),
  links: candidateLinksSchema,
});

const offerGeminiOfferSchema = z.object({
  jobOfferId: z.string(),
  sourceSite: z.string(),
  sourceUrl: z.string(),
  title: z.string(),
  companyName: z.string(),
  locationLabel: z.string().nullable(),
  lifecycleStatus: z.string(),
  contractType: z.string().nullable(),
  workMode: z.string().nullable(),
  postedAt: z.string().nullable(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
});

const offerGeminiSignalsSchema = z.object({
  latestMatchScore: z.number().nullable(),
  latestRank: z.number().int().nullable(),
  latestSearchLabel: z.string().nullable(),
  latestSearchStatus: z.string().nullable(),
  matchExplanation: z.string().nullable(),
  latestFeedbackDecision: z.string().nullable(),
  latestFeedbackNote: z.string().nullable(),
  isShortlisted: z.boolean(),
});

export const offerGeminiContextSchema = z.object({
  generatedAt: z.string().datetime(),
  candidate: offerGeminiCandidateSchema,
  offer: offerGeminiOfferSchema,
  signals: offerGeminiSignalsSchema,
});

export type OfferGeminiContext = z.infer<typeof offerGeminiContextSchema>;

export class OfferGeminiContextError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OfferGeminiContextError";
  }
}

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export async function buildOfferGeminiContext(
  userId: string,
  jobOfferId: string,
): Promise<OfferGeminiContext> {
  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      fullName: true,
      profile: {
        select: {
          headline: true,
          summary: true,
          school: true,
          degree: true,
          graduationYear: true,
          city: true,
          countryCode: true,
          availabilityDate: true,
          linkedinUrl: true,
          githubUrl: true,
          portfolioUrl: true,
          resumeUrl: true,
          constraints: true,
          skills: {
            orderBy: [
              {
                isHighlighted: "desc",
              },
              {
                createdAt: "asc",
              },
            ],
            select: {
              name: true,
            },
          },
        },
      },
      searchTargets: {
        where: {
          isActive: true,
        },
        orderBy: {
          priority: "desc",
        },
        select: {
          title: true,
        },
      },
      searchDomains: {
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          label: true,
        },
      },
      searchLocations: {
        orderBy: {
          priority: "desc",
        },
        select: {
          label: true,
        },
      },
      jobOffers: {
        where: {
          id: jobOfferId,
        },
        select: {
          id: true,
          sourceSite: true,
          sourceUrl: true,
          title: true,
          companyName: true,
          locationLabel: true,
          status: true,
          employmentType: true,
          workMode: true,
          postedAt: true,
          description: true,
          searchMatches: {
            orderBy: {
              discoveredAt: "desc",
            },
            take: 1,
            select: {
              rank: true,
              rawScore: true,
              matchExplanation: true,
              isShortlisted: true,
              searchRun: {
                select: {
                  label: true,
                  status: true,
                },
              },
            },
          },
          feedbackEntries: {
            orderBy: {
              updatedAt: "desc",
            },
            take: 1,
            select: {
              decision: true,
              note: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new OfferGeminiContextError("User not found", 404);
  }

  if (!user.profile) {
    throw new OfferGeminiContextError("Profile not found", 404);
  }

  const offer = user.jobOffers[0];

  if (!offer) {
    throw new OfferGeminiContextError("Offer not found", 404);
  }

  const latestMatch = offer.searchMatches[0] ?? null;
  const latestFeedback = offer.feedbackEntries[0] ?? null;
  const constraints = user.profile.constraints;

  return offerGeminiContextSchema.parse({
    generatedAt: new Date().toISOString(),
    candidate: {
      fullName: user.fullName ?? user.profile.headline ?? "Utilisateur",
      headline: user.profile.headline,
      summary: user.profile.summary,
      school: user.profile.school,
      degree: user.profile.degree,
      graduationYear: user.profile.graduationYear,
      city: user.profile.city,
      countryCode: user.profile.countryCode,
      availabilityDate: toIsoString(user.profile.availabilityDate),
      availabilityEndDate: readStringConstraint(constraints, "availabilityEndDate"),
      skills: user.profile.skills.map((skill) => skill.name),
      targetRoles: user.searchTargets.map((target) => target.title),
      preferredDomains: user.searchDomains.map((domain) => domain.label),
      preferredLocations: user.searchLocations.map((location) => location.label),
      searchKeywords: readStringArrayConstraint(constraints, "searchKeywords"),
      employmentTypes: readStringArrayConstraint(constraints, "employmentTypes"),
      preferencesNotes: readStringConstraint(constraints, "preferencesNotes"),
      links: {
        linkedinUrl: user.profile.linkedinUrl,
        githubUrl: user.profile.githubUrl,
        portfolioUrl: user.profile.portfolioUrl,
        resumeUrl: user.profile.resumeUrl,
      },
    },
    offer: {
      jobOfferId: offer.id,
      sourceSite: offer.sourceSite,
      sourceUrl: offer.sourceUrl,
      title: offer.title,
      companyName: offer.companyName,
      locationLabel: offer.locationLabel,
      lifecycleStatus: offer.status,
      contractType: offer.employmentType,
      workMode: offer.workMode,
      postedAt: toIsoString(offer.postedAt),
      summary: offer.description,
      description: offer.description,
    },
    signals: {
      latestMatchScore:
        typeof latestMatch?.rawScore === "number" ? Math.round(latestMatch.rawScore) : null,
      latestRank: latestMatch?.rank ?? null,
      latestSearchLabel: latestMatch?.searchRun.label ?? null,
      latestSearchStatus: latestMatch?.searchRun.status ?? null,
      matchExplanation: latestMatch?.matchExplanation ?? null,
      latestFeedbackDecision: latestFeedback?.decision ?? null,
      latestFeedbackNote: latestFeedback?.note ?? null,
      isShortlisted: latestMatch?.isShortlisted ?? false,
    },
  });
}
