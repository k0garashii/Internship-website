import { EmploymentType, type WorkMode } from "@prisma/client";
import { z } from "zod";

import {
  employmentTypeValues,
  listItemSchema,
  normalizeListItem,
  readStringArrayConstraint,
  searchTargetsInputSchema,
  slugify,
} from "@/lib/profile/schema";

const prioritySchema = z.number().int().min(0).max(100).default(50);
const optionalCountryCodeSchema = z
  .union([z.string().trim().max(2), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value.toUpperCase() : null))
  .default(null);

export const searchTargetItemSchema = z.object({
  title: z.string().trim().min(2).max(160),
  employmentTypes: z.array(z.enum(employmentTypeValues)).max(4).default([]),
  priority: prioritySchema,
  isActive: z.boolean().default(true),
});

export const searchLocationItemSchema = z.object({
  label: z.string().trim().min(2).max(160),
  countryCode: optionalCountryCodeSchema,
  isRemote: z.boolean().default(false),
  isHybrid: z.boolean().default(false),
  priority: prioritySchema,
});

export const searchDomainItemSchema = z.object({
  label: z.string().trim().min(2).max(160),
  rationale: z
    .union([z.string().trim().max(240), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value ? value : null))
    .default(null),
});

export const searchTargetsFileSchema = z.object({
  version: z.literal(1).default(1),
  targets: z.array(searchTargetItemSchema).max(100).default([]),
  keywords: z.array(listItemSchema).max(100).default([]),
  preferredLocations: z.array(searchLocationItemSchema).max(50).default([]),
  preferredDomains: z.array(searchDomainItemSchema).max(50).default([]),
});

export type SearchTargetsFile = z.output<typeof searchTargetsFileSchema>;

export function exportSearchTargetsFile(account: {
  profile:
    | {
        constraints: unknown;
      }
    | null;
  searchTargets: Array<{
    title: string;
    contractTypes: EmploymentType[];
    priority: number;
    isActive: boolean;
  }>;
  searchLocations: Array<{
    label: string;
    countryCode: string | null;
    isRemote: boolean;
    isHybrid: boolean;
    priority: number;
  }>;
  searchDomains: Array<{
    label: string;
    rationale: string | null;
  }>;
}) {
  return searchTargetsFileSchema.parse({
    version: 1,
    targets: account.searchTargets.map((target) => ({
      title: target.title,
      employmentTypes: target.contractTypes,
      priority: target.priority,
      isActive: target.isActive,
    })),
    keywords: readStringArrayConstraint(account.profile?.constraints, "searchKeywords"),
    preferredLocations: account.searchLocations.map((location) => ({
      label: location.label,
      countryCode: location.countryCode,
      isRemote: location.isRemote,
      isHybrid: location.isHybrid,
      priority: location.priority,
    })),
    preferredDomains: account.searchDomains.map((domain) => ({
      label: domain.label,
      rationale: domain.rationale,
    })),
  });
}

export function importSearchTargetsFile(file: SearchTargetsFile, options?: { remotePreference?: WorkMode | null }) {
  const keywordText = file.keywords.map((keyword) => normalizeListItem(keyword)).join(", ");
  const targetRoles = file.targets.map((target) => normalizeListItem(target.title));
  const preferredLocations = file.preferredLocations.map((location) =>
    normalizeListItem(location.label),
  );
  const preferredDomains = file.preferredDomains.map((domain) => normalizeListItem(domain.label));
  const employmentTypes = Array.from(
    new Set(file.targets.flatMap((target) => target.employmentTypes)),
  );

  const parsedInput = searchTargetsInputSchema.parse({
    targetRoles: targetRoles.join(", "),
    searchKeywords: keywordText,
    preferredLocations: preferredLocations.join(", "),
    preferredDomains: preferredDomains.join(", "),
    employmentTypes,
  });

  return {
    parsedInput,
    targets: file.targets.map((target) => ({
      title: normalizeListItem(target.title),
      normalizedTitle: slugify(target.title),
      employmentTypes: target.employmentTypes,
      priority: target.priority,
      isActive: target.isActive,
    })),
    locations: file.preferredLocations.map((location) => ({
      label: normalizeListItem(location.label),
      normalizedLabel: slugify(location.label),
      countryCode: location.countryCode,
      isRemote: location.isRemote,
      isHybrid: location.isHybrid,
      priority: location.priority,
    })),
    domains: file.preferredDomains.map((domain) => ({
      label: normalizeListItem(domain.label),
      normalizedLabel: slugify(domain.label),
      rationale: domain.rationale,
    })),
    remotePreference: options?.remotePreference ?? null,
  };
}

export function getSearchTargetsExample() {
  return searchTargetsFileSchema.parse({
    version: 1,
    targets: [
      {
        title: "Backend Engineer Intern",
        employmentTypes: ["INTERNSHIP"],
        priority: 90,
        isActive: true,
      },
      {
        title: "Platform Engineer Intern",
        employmentTypes: ["INTERNSHIP"],
        priority: 80,
        isActive: true,
      },
    ],
    keywords: ["TypeScript", "Node.js", "automation"],
    preferredLocations: [
      {
        label: "Paris",
        countryCode: "FR",
        isRemote: false,
        isHybrid: true,
        priority: 90,
      },
      {
        label: "Remote",
        countryCode: null,
        isRemote: true,
        isHybrid: false,
        priority: 80,
      },
    ],
    preferredDomains: [
      {
        label: "Developer Tools",
        rationale: "Fort alignement avec les competences backend et automatisation.",
      },
      {
        label: "SaaS B2B",
        rationale: "Contexte produit adapte a une recherche de stage software.",
      },
    ],
  });
}
