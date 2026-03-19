import {
  ExperienceLevel,
  TargetSource,
  WorkMode,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { type AuthenticatedViewer, assertAuthenticatedViewer } from "@/lib/auth/viewer";
import {
  companyWatchlistFileSchema,
  parseCompanyWatchlistFile,
} from "@/lib/config/company-watchlist";
import {
  exportPersonalProfileFile,
  importPersonalProfileFile,
  personalProfileFileSchema,
} from "@/lib/config/personal-profile";
import {
  exportSearchTargetsFile,
  importSearchTargetsFile,
  searchTargetsFileSchema,
} from "@/lib/config/search-targets";
import {
  readStringArrayConstraint,
  readStringConstraint,
  slugify,
} from "@/lib/profile/schema";

const configImportRequestSchema = z.object({
  personalProfile: personalProfileFileSchema.optional(),
  searchTargets: searchTargetsFileSchema.optional(),
  companyWatchlist: companyWatchlistFileSchema.optional(),
});

export class UserConfigError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "UserConfigError";
  }
}

function buildMergedConstraints(
  existing: unknown,
  updates: Partial<{
    availabilityEndDate: string | null;
    preferencesNotes: string | null;
    employmentTypes: string[];
    searchKeywords: string[];
  }>,
): Prisma.JsonObject {
  return {
    availabilityEndDate:
      updates.availabilityEndDate ??
      readStringConstraint(existing, "availabilityEndDate") ??
      null,
    preferencesNotes:
      updates.preferencesNotes ??
      readStringConstraint(existing, "preferencesNotes") ??
      null,
    employmentTypes:
      updates.employmentTypes ?? readStringArrayConstraint(existing, "employmentTypes"),
    searchKeywords:
      updates.searchKeywords ?? readStringArrayConstraint(existing, "searchKeywords"),
  };
}

async function getExportSnapshot(userId: string) {
  return db.user.findUnique({
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
          remotePreference: true,
          experienceLevel: true,
          availabilityDate: true,
          linkedinUrl: true,
          githubUrl: true,
          portfolioUrl: true,
          resumeUrl: true,
          visaNeedsSponsorship: true,
          salaryExpectationMin: true,
          salaryExpectationMax: true,
          constraints: true,
          skills: {
            orderBy: {
              isHighlighted: "desc",
            },
            select: {
              name: true,
            },
          },
        },
      },
      searchTargets: {
        orderBy: {
          priority: "desc",
        },
        select: {
          title: true,
          contractTypes: true,
          priority: true,
          isActive: true,
        },
      },
      searchLocations: {
        orderBy: {
          priority: "desc",
        },
        select: {
          label: true,
          countryCode: true,
          isRemote: true,
          isHybrid: true,
          priority: true,
        },
      },
      searchDomains: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          label: true,
          rationale: true,
        },
      },
      companyWatchlist: {
        orderBy: {
          priority: "desc",
        },
        select: {
          companyName: true,
          websiteUrl: true,
          careerPageUrl: true,
          notes: true,
          priority: true,
          isActive: true,
        },
      },
    },
  });
}

export async function exportUserConfig(viewer: AuthenticatedViewer) {
  const authenticatedViewer = assertAuthenticatedViewer(viewer);
  const snapshot = await getExportSnapshot(authenticatedViewer.userId);

  if (!snapshot) {
    throw new UserConfigError("User not found", 404);
  }

  return {
    personalProfile: exportPersonalProfileFile(snapshot),
    searchTargets: exportSearchTargetsFile(snapshot),
    companyWatchlist: parseCompanyWatchlistFile({
      version: 1,
      items: snapshot.companyWatchlist,
    }),
  };
}

export async function importUserConfig(viewer: AuthenticatedViewer, input: unknown) {
  const authenticatedViewer = assertAuthenticatedViewer(viewer);
  const parsed = configImportRequestSchema.safeParse(input);

  if (!parsed.success) {
    throw new UserConfigError(
      "Invalid configuration payload",
      400,
      parsed.error.flatten().fieldErrors,
    );
  }

  const sections = parsed.data;

  if (!sections.personalProfile && !sections.searchTargets && !sections.companyWatchlist) {
    throw new UserConfigError("Nothing to import", 400);
  }

  await db.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: {
        id: authenticatedViewer.userId,
      },
      select: {
        profile: {
          select: {
            id: true,
            constraints: true,
            remotePreference: true,
          },
        },
      },
    });

    if (!existingUser) {
      throw new UserConfigError("User not found", 404);
    }

    if (sections.personalProfile) {
      const importedProfile = importPersonalProfileFile(sections.personalProfile);

      await tx.user.update({
        where: {
          id: authenticatedViewer.userId,
        },
        data: {
          fullName: importedProfile.parsedInput.fullName,
        },
      });

      const profile = await tx.userProfile.upsert({
        where: {
          userId: authenticatedViewer.userId,
        },
        update: {
          headline: importedProfile.parsedInput.headline || null,
          summary: importedProfile.parsedInput.summary || null,
          school: importedProfile.parsedInput.school || null,
          degree: importedProfile.parsedInput.degree || null,
          graduationYear: importedProfile.parsedInput.graduationYear,
          city: importedProfile.parsedInput.city || null,
          countryCode: importedProfile.parsedInput.countryCode || null,
          remotePreference: importedProfile.parsedInput.remotePreference as WorkMode | null,
          experienceLevel:
            importedProfile.parsedInput.experienceLevel as ExperienceLevel | null,
          availabilityDate: importedProfile.parsedInput.availabilityDate
            ? new Date(importedProfile.parsedInput.availabilityDate)
            : null,
          linkedinUrl: importedProfile.parsedInput.linkedinUrl || null,
          githubUrl: importedProfile.parsedInput.githubUrl || null,
          portfolioUrl: importedProfile.parsedInput.portfolioUrl || null,
          resumeUrl: importedProfile.parsedInput.resumeUrl || null,
          visaNeedsSponsorship: importedProfile.parsedInput.visaNeedsSponsorship,
          salaryExpectationMin: importedProfile.parsedInput.salaryExpectationMin,
          salaryExpectationMax: importedProfile.parsedInput.salaryExpectationMax,
          constraints: buildMergedConstraints(existingUser.profile?.constraints, {
            availabilityEndDate: importedProfile.parsedInput.availabilityEndDate || null,
            preferencesNotes: importedProfile.parsedInput.preferencesNotes || null,
          }),
        },
        create: {
          userId: authenticatedViewer.userId,
          headline: importedProfile.parsedInput.headline || null,
          summary: importedProfile.parsedInput.summary || null,
          school: importedProfile.parsedInput.school || null,
          degree: importedProfile.parsedInput.degree || null,
          graduationYear: importedProfile.parsedInput.graduationYear,
          city: importedProfile.parsedInput.city || null,
          countryCode: importedProfile.parsedInput.countryCode || null,
          remotePreference: importedProfile.parsedInput.remotePreference as WorkMode | null,
          experienceLevel:
            importedProfile.parsedInput.experienceLevel as ExperienceLevel | null,
          availabilityDate: importedProfile.parsedInput.availabilityDate
            ? new Date(importedProfile.parsedInput.availabilityDate)
            : null,
          linkedinUrl: importedProfile.parsedInput.linkedinUrl || null,
          githubUrl: importedProfile.parsedInput.githubUrl || null,
          portfolioUrl: importedProfile.parsedInput.portfolioUrl || null,
          resumeUrl: importedProfile.parsedInput.resumeUrl || null,
          visaNeedsSponsorship: importedProfile.parsedInput.visaNeedsSponsorship,
          salaryExpectationMin: importedProfile.parsedInput.salaryExpectationMin,
          salaryExpectationMax: importedProfile.parsedInput.salaryExpectationMax,
          constraints: buildMergedConstraints({}, {
            availabilityEndDate: importedProfile.parsedInput.availabilityEndDate || null,
            preferencesNotes: importedProfile.parsedInput.preferencesNotes || null,
          }),
        },
        select: {
          id: true,
        },
      });

      await tx.profileSkill.deleteMany({
        where: {
          profileId: profile.id,
        },
      });

      if (importedProfile.normalizedSkills.length > 0) {
        await tx.profileSkill.createMany({
          data: importedProfile.normalizedSkills.map((skill, index) => ({
            profileId: profile.id,
            name: skill.name,
            normalizedName: skill.normalizedName,
            isHighlighted: index < 5,
          })),
        });
      }
    }

    if (sections.searchTargets) {
      const importedTargets = importSearchTargetsFile(sections.searchTargets);

      await tx.userProfile.upsert({
        where: {
          userId: authenticatedViewer.userId,
        },
        update: {
          constraints: buildMergedConstraints(existingUser.profile?.constraints, {
            employmentTypes: importedTargets.parsedInput.employmentTypes,
            searchKeywords: importedTargets.parsedInput.searchKeywords
              ? importedTargets.parsedInput.searchKeywords
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : [],
          }),
        },
        create: {
          userId: authenticatedViewer.userId,
          remotePreference: existingUser.profile?.remotePreference ?? null,
          constraints: buildMergedConstraints({}, {
            employmentTypes: importedTargets.parsedInput.employmentTypes,
            searchKeywords: importedTargets.parsedInput.searchKeywords
              ? importedTargets.parsedInput.searchKeywords
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : [],
          }),
        },
      });

      await tx.searchTarget.deleteMany({
        where: {
          userId: authenticatedViewer.userId,
        },
      });

      if (importedTargets.targets.length > 0) {
        await tx.searchTarget.createMany({
          data: importedTargets.targets.map((target) => ({
            userId: authenticatedViewer.userId,
            title: target.title,
            normalizedTitle: target.normalizedTitle,
            source: TargetSource.IMPORTED,
            contractTypes: target.employmentTypes,
            priority: target.priority,
            isActive: target.isActive,
          })),
        });
      }

      await tx.searchLocation.deleteMany({
        where: {
          userId: authenticatedViewer.userId,
        },
      });

      if (importedTargets.locations.length > 0) {
        await tx.searchLocation.createMany({
          data: importedTargets.locations.map((location) => ({
            userId: authenticatedViewer.userId,
            label: location.label,
            normalizedLabel: location.normalizedLabel,
            countryCode: location.countryCode,
            isRemote: location.isRemote,
            isHybrid: location.isHybrid,
            priority: location.priority,
          })),
        });
      }

      await tx.searchDomain.deleteMany({
        where: {
          userId: authenticatedViewer.userId,
        },
      });

      if (importedTargets.domains.length > 0) {
        await tx.searchDomain.createMany({
          data: importedTargets.domains.map((domain) => ({
            userId: authenticatedViewer.userId,
            label: domain.label,
            normalizedLabel: domain.normalizedLabel,
            rationale: domain.rationale,
            isValidated: true,
          })),
        });
      }
    }

    if (sections.companyWatchlist) {
      const importedWatchlist = parseCompanyWatchlistFile(sections.companyWatchlist);

      await tx.companyWatchlistItem.deleteMany({
        where: {
          userId: authenticatedViewer.userId,
        },
      });

      if (importedWatchlist.items.length > 0) {
        await tx.companyWatchlistItem.createMany({
          data: importedWatchlist.items.map((item) => ({
            userId: authenticatedViewer.userId,
            companyName: item.companyName,
            normalizedName: item.normalizedName,
            websiteUrl: item.websiteUrl,
            careerPageUrl: item.careerPageUrl,
            notes: item.notes,
            priority: item.priority,
            isActive: item.isActive,
          })),
        });
      }
    }
  });

  return {
    importedAt: new Date().toISOString(),
    sections: {
      personalProfile: Boolean(sections.personalProfile),
      searchTargets: Boolean(sections.searchTargets),
      companyWatchlist: Boolean(sections.companyWatchlist),
    },
  };
}

export function getConfigExportExample() {
  return {
    personalProfile: personalProfileFileSchema.parse({
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
          preferencesNotes: "Scope europe et equipe produit.",
        },
      },
    }),
    searchTargets: searchTargetsFileSchema.parse({
      version: 1,
      targets: [
        {
          title: "Backend Engineer Intern",
          employmentTypes: ["INTERNSHIP"],
          priority: 90,
          isActive: true,
        },
      ],
      keywords: ["TypeScript", "automation"],
      preferredLocations: [
        {
          label: "Paris",
          countryCode: "FR",
          isRemote: false,
          isHybrid: true,
          priority: 90,
        },
      ],
      preferredDomains: [
        {
          label: "Developer Tools",
          rationale: "Alignement fort avec le profil technique.",
        },
      ],
    }),
    companyWatchlist: companyWatchlistFileSchema.parse({
      version: 1,
      items: [
        {
          companyName: "Alan",
          websiteUrl: "https://alan.com",
          careerPageUrl: "https://alan.com/careers",
          notes: "Produit B2B SaaS europeen",
          priority: 80,
          isActive: true,
        },
      ],
    }),
  };
}
