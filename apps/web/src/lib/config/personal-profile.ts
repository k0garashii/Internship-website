import type { ExperienceLevel, WorkMode } from "@prisma/client";
import { z } from "zod";

import {
  experienceLevelValues,
  listItemSchema,
  normalizeListItem,
  personalProfileInputSchema,
  slugify,
  workModeValues,
} from "@/lib/profile/schema";

const optionalUrlSchema = z
  .union([z.url(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));
const optionalDateSchema = z
  .union([z.string().trim(), z.null(), z.undefined()])
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
    message: "Availability date must be valid",
  });
const nullableShortTextSchema = z
  .union([z.string().trim().max(160), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));
const nullableLongTextSchema = z
  .union([z.string().trim().max(2000), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));
const nullableIntSchema = z
  .union([z.number().int(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "number" ? value : null));

export const personalProfileFileSchema = z.object({
  version: z.literal(1).default(1),
  profile: z.object({
    fullName: z.string().trim().min(2).max(120),
    headline: nullableShortTextSchema.default(null),
    summary: nullableLongTextSchema.default(null),
    school: nullableShortTextSchema.default(null),
    degree: nullableShortTextSchema.default(null),
    graduationYear: nullableIntSchema.default(null),
    city: z
      .union([z.string().trim().max(120), z.literal(""), z.null(), z.undefined()])
      .transform((value) => (value ? value : null))
      .default(null),
    countryCode: z
      .union([z.string().trim().max(2), z.literal(""), z.null(), z.undefined()])
      .transform((value) => (value ? value.toUpperCase() : null))
      .default(null),
    remotePreference: z
      .union([z.enum(workModeValues), z.literal(""), z.null(), z.undefined()])
      .transform((value) => (value ? value : null))
      .default(null),
    experienceLevel: z
      .union([z.enum(experienceLevelValues), z.literal(""), z.null(), z.undefined()])
      .transform((value) => (value ? value : null))
      .default(null),
    availabilityDate: optionalDateSchema.default(null),
    links: z.object({
      linkedinUrl: optionalUrlSchema.optional().default(null),
      githubUrl: optionalUrlSchema.optional().default(null),
      portfolioUrl: optionalUrlSchema.optional().default(null),
      resumeUrl: optionalUrlSchema.optional().default(null),
    }),
    skills: z.array(listItemSchema).max(100).default([]),
    constraints: z.object({
      visaNeedsSponsorship: z.boolean().default(false),
      salaryExpectationMin: nullableIntSchema.default(null),
      salaryExpectationMax: nullableIntSchema.default(null),
      availabilityEndDate: optionalDateSchema.default(null),
      preferencesNotes: z
        .union([z.string().trim().max(1000), z.literal(""), z.null(), z.undefined()])
        .transform((value) => (value ? value : null))
        .default(null),
    }),
  }),
});

export type PersonalProfileFile = z.output<typeof personalProfileFileSchema>;

export function exportPersonalProfileFile(account: {
  fullName: string | null;
  profile:
    | {
        headline: string | null;
        summary: string | null;
        school: string | null;
        degree: string | null;
        graduationYear: number | null;
        city: string | null;
        countryCode: string | null;
        remotePreference: WorkMode | null;
        experienceLevel: ExperienceLevel | null;
        availabilityDate: Date | null;
        linkedinUrl: string | null;
        githubUrl: string | null;
        portfolioUrl: string | null;
        resumeUrl: string | null;
        visaNeedsSponsorship: boolean;
        salaryExpectationMin: number | null;
        salaryExpectationMax: number | null;
        constraints: unknown;
        skills: Array<{ name: string }>;
      }
    | null;
}) {
  return personalProfileFileSchema.parse({
    version: 1,
    profile: {
      fullName: account.fullName ?? "Utilisateur",
      headline: account.profile?.headline ?? null,
      summary: account.profile?.summary ?? null,
      school: account.profile?.school ?? null,
      degree: account.profile?.degree ?? null,
      graduationYear: account.profile?.graduationYear ?? null,
      city: account.profile?.city ?? null,
      countryCode: account.profile?.countryCode ?? null,
      remotePreference: account.profile?.remotePreference ?? null,
      experienceLevel: account.profile?.experienceLevel ?? null,
      availabilityDate: account.profile?.availabilityDate?.toISOString().slice(0, 10) ?? null,
      links: {
        linkedinUrl: account.profile?.linkedinUrl ?? null,
        githubUrl: account.profile?.githubUrl ?? null,
        portfolioUrl: account.profile?.portfolioUrl ?? null,
        resumeUrl: account.profile?.resumeUrl ?? null,
      },
      skills: account.profile?.skills.map((skill) => skill.name) ?? [],
      constraints: {
        visaNeedsSponsorship: account.profile?.visaNeedsSponsorship ?? false,
        salaryExpectationMin: account.profile?.salaryExpectationMin ?? null,
        salaryExpectationMax: account.profile?.salaryExpectationMax ?? null,
        availabilityEndDate: account.profile?.constraints
          ? ((account.profile.constraints as Record<string, unknown>).availabilityEndDate as
              | string
              | null
              | undefined) ?? null
          : null,
        preferencesNotes: account.profile?.constraints
          ? (account.profile.constraints as Record<string, unknown>).preferencesNotes ?? null
          : null,
      },
    },
  });
}

export function importPersonalProfileFile(file: PersonalProfileFile) {
  const parsedInput = personalProfileInputSchema.parse({
    fullName: file.profile.fullName,
    headline: file.profile.headline ?? "",
    summary: file.profile.summary ?? "",
    school: file.profile.school ?? "",
    degree: file.profile.degree ?? "",
    graduationYear: file.profile.graduationYear?.toString() ?? "",
    city: file.profile.city ?? "",
    countryCode: file.profile.countryCode ?? "",
    remotePreference: file.profile.remotePreference ?? "",
    experienceLevel: file.profile.experienceLevel ?? "",
    availabilityDate: file.profile.availabilityDate ?? "",
    availabilityEndDate: file.profile.constraints.availabilityEndDate ?? "",
    linkedinUrl: file.profile.links.linkedinUrl ?? "",
    githubUrl: file.profile.links.githubUrl ?? "",
    portfolioUrl: file.profile.links.portfolioUrl ?? "",
    resumeUrl: file.profile.links.resumeUrl ?? "",
    visaNeedsSponsorship: file.profile.constraints.visaNeedsSponsorship,
    salaryExpectationMin: file.profile.constraints.salaryExpectationMin?.toString() ?? "",
    salaryExpectationMax: file.profile.constraints.salaryExpectationMax?.toString() ?? "",
    skills: file.profile.skills.map((skill) => normalizeListItem(skill)).join(", "),
    preferencesNotes: file.profile.constraints.preferencesNotes ?? "",
  });

  return {
    parsedInput,
    skills: file.profile.skills.map((skill) => normalizeListItem(skill)),
    normalizedSkills: file.profile.skills.map((skill) => ({
      name: normalizeListItem(skill),
      normalizedName: slugify(skill),
    })),
  };
}

export function getPersonalProfileExample() {
  return personalProfileFileSchema.parse({
    version: 1,
    profile: {
      fullName: "Sasha Martin",
      headline: "Etudiant ingenieur backend a la recherche d un stage",
      summary: "Je cible des equipes produit avec une forte composante TypeScript et automatisation.",
      school: "EPITA",
      degree: "Cycle ingenieur",
      graduationYear: 2027,
      city: "Paris",
      countryCode: "FR",
      remotePreference: "HYBRID",
      experienceLevel: "INTERN",
      availabilityDate: "2026-09-01",
      links: {
        linkedinUrl: "https://linkedin.com/in/sasha-martin",
        githubUrl: "https://github.com/sasha-martin",
        portfolioUrl: null,
        resumeUrl: null,
      },
      skills: ["TypeScript", "Node.js", "Prisma"],
      constraints: {
        visaNeedsSponsorship: false,
        salaryExpectationMin: 1200,
        salaryExpectationMax: 1800,
        availabilityEndDate: "2027-02-28",
        preferencesNotes: "Je privilegie les equipes produit avec un scope europe.",
      },
    },
  });
}
