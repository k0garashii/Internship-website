import type { Prisma } from "@prisma/client";
import { z } from "zod";

export const experienceLevelValues = [
  "INTERN",
  "ENTRY_LEVEL",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
] as const;
export const workModeValues = ["REMOTE", "HYBRID", "ONSITE", "FLEXIBLE"] as const;
export const employmentTypeValues = [
  "INTERNSHIP",
  "APPRENTICESHIP",
  "FULL_TIME",
  "PART_TIME",
  "TEMPORARY",
  "FREELANCE",
] as const;
export const domainSelectionSourceValues = ["MANUAL", "GEMINI"] as const;

type JsonRecord = Record<string, unknown>;

export const listItemSchema = z.string().trim().min(1).max(160);

export function normalizeListItem(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function slugify(value: string) {
  return normalizeListItem(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function splitMultilineOrCommaList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => normalizeListItem(item))
    .filter(Boolean);
}

const trimmedStringSchema = z.string().trim();
const optionalTextSchema = trimmedStringSchema.max(2000).optional().default("");
const optionalShortTextSchema = trimmedStringSchema.max(160).optional().default("");

function normalizeOptionalUrlInput(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    const hasValidHostname =
      hostname === "localhost" ||
      hostname.includes(".") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
      hostname.includes(":");

    if (!["http:", "https:"].includes(parsed.protocol) || !hasValidHostname) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

const optionalUrlInputSchema = trimmedStringSchema
  .optional()
  .default("")
  .transform((value) => normalizeOptionalUrlInput(value))
  .refine((value) => value !== null, {
    message: "Invalid URL",
  })
  .transform((value) => value ?? "");

const graduationYearInputSchema = z
  .union([trimmedStringSchema, z.null(), z.undefined()])
  .transform((value) => {
    if (!value) {
      return null;
    }

    const year = Number(value);
    return Number.isFinite(year) ? year : Number.NaN;
  })
  .refine((value) => value === null || (value >= 2020 && value <= 2100), {
    message: "Graduation year must be between 2020 and 2100",
  });

const nullableEnumSchema = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal(""), z.null(), z.undefined()]).transform((value) =>
    value ? value : null,
  );

const nullableDateInputSchema = z
  .union([trimmedStringSchema, z.null(), z.undefined()])
  .transform((value) => (value ? value : null))
  .refine(
    (value) => value === null || !Number.isNaN(Date.parse(value)),
    "Availability date must be valid",
  );

const nullableNumberInputSchema = (message: string) =>
  z
    .union([trimmedStringSchema, z.null(), z.undefined()])
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || Number.isFinite(value), message);

export const personalProfileInputSchema = z.object({
  fullName: trimmedStringSchema.min(2).max(120),
  headline: optionalShortTextSchema,
  summary: optionalTextSchema,
  school: optionalShortTextSchema,
  degree: optionalShortTextSchema,
  graduationYear: graduationYearInputSchema,
  city: trimmedStringSchema.max(120).optional().default(""),
  countryCode: trimmedStringSchema.max(2).optional().default(""),
  remotePreference: nullableEnumSchema(workModeValues),
  experienceLevel: nullableEnumSchema(experienceLevelValues),
  availabilityDate: nullableDateInputSchema,
  availabilityEndDate: nullableDateInputSchema,
  linkedinUrl: optionalUrlInputSchema,
  githubUrl: optionalUrlInputSchema,
  portfolioUrl: optionalUrlInputSchema,
  resumeUrl: optionalUrlInputSchema,
  visaNeedsSponsorship: z.boolean().default(false),
  salaryExpectationMin: nullableNumberInputSchema("Invalid minimum salary"),
  salaryExpectationMax: nullableNumberInputSchema("Invalid maximum salary"),
  skills: z.string().default(""),
  preferencesNotes: trimmedStringSchema.max(1000).optional().default(""),
});

export const searchTargetsInputSchema = z.object({
  targetRoles: z.string().default(""),
  searchKeywords: z.string().default(""),
  preferredLocations: z.string().default(""),
  preferredDomains: z.string().default(""),
  employmentTypes: z.array(z.enum(employmentTypeValues)).max(4).default([]),
});

export const domainSelectionInputSchema = z.object({
  label: trimmedStringSchema.min(2).max(160),
  rationale: trimmedStringSchema.max(240).optional().default(""),
  source: z.enum(domainSelectionSourceValues).default("MANUAL"),
  isValidated: z.boolean().default(true),
});

export const profileOnboardingSchema = personalProfileInputSchema
  .merge(searchTargetsInputSchema)
  .extend({
    domainSelections: z.array(domainSelectionInputSchema).max(50).optional(),
  });

export type ProfileOnboardingInput = z.input<typeof profileOnboardingSchema>;
export type ProfileOnboardingData = z.output<typeof profileOnboardingSchema>;

export function buildProfileConstraints(parsed: ProfileOnboardingData): Prisma.JsonObject {
  return {
    availabilityEndDate: parsed.availabilityEndDate || null,
    preferencesNotes: parsed.preferencesNotes || null,
    employmentTypes: parsed.employmentTypes,
    searchKeywords: splitMultilineOrCommaList(parsed.searchKeywords),
  };
}

export function readStringConstraint(value: unknown, key: string) {
  if (
    typeof value === "object" &&
    value !== null &&
    key in (value as JsonRecord) &&
    typeof (value as JsonRecord)[key] === "string"
  ) {
    return (value as JsonRecord)[key] as string;
  }

  return "";
}

export function readStringArrayConstraint(value: unknown, key: string) {
  if (
    typeof value === "object" &&
    value !== null &&
    key in (value as JsonRecord) &&
    Array.isArray((value as JsonRecord)[key])
  ) {
    return ((value as JsonRecord)[key] as unknown[])
      .filter((item): item is string => typeof item === "string")
      .map((item) => normalizeListItem(item))
      .filter(Boolean);
  }

  return [];
}
