import { db } from "@/lib/db";
import {
  readBooleanConstraint,
  readNumberConstraint,
  readStringArrayConstraint,
  readStringConstraint,
} from "@/lib/profile/schema";

export async function getProfileFormData(userId: string) {
  return db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      fullName: true,
      email: true,
      profile: {
        select: {
          id: true,
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
          resumeFileName: true,
          resumeUploadedAt: true,
          dailyDigestEnabled: true,
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
        where: {
          isActive: true,
        },
        orderBy: {
          priority: "desc",
        },
        select: {
          title: true,
          contractTypes: true,
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
      searchDomains: {
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          label: true,
          rationale: true,
          source: true,
          isValidated: true,
        },
      },
    },
  });
}

function toLicenseChoice(value: boolean | null) {
  return value === true ? "yes" : value === false ? "no" : "";
}

export function mapAccountToProfileDraft(
  account: NonNullable<Awaited<ReturnType<typeof getProfileFormData>>>,
) {
  return {
    fullName: account.fullName ?? "",
    email: account.email,
    resumeFileName: account.profile?.resumeFileName ?? null,
    resumeUploadedAt: account.profile?.resumeUploadedAt?.toISOString() ?? null,
    dailyDigestEnabled: account.profile?.dailyDigestEnabled ?? true,
    domains: account.searchDomains.map((domain) => ({
      id: domain.id,
      label: domain.label,
      rationale: domain.rationale ?? "",
      source: (domain.source === "GEMINI" ? "GEMINI" : "MANUAL") as "GEMINI" | "MANUAL",
      isValidated: domain.isValidated,
    })),
    profile: {
      headline: account.profile?.headline ?? "",
      summary: account.profile?.summary ?? "",
      school: account.profile?.school ?? "",
      degree: account.profile?.degree ?? "",
      graduationYear: account.profile?.graduationYear?.toString() ?? "",
      city: account.profile?.city ?? "",
      countryCode: account.profile?.countryCode ?? "",
      remotePreference: account.profile?.remotePreference ?? "",
      experienceLevel: account.profile?.experienceLevel ?? "",
      availabilityDate: account.profile?.availabilityDate?.toISOString().slice(0, 10) ?? "",
      availabilityEndDate: readStringConstraint(
        account.profile?.constraints,
        "availabilityEndDate",
      ),
      linkedinUrl: account.profile?.linkedinUrl ?? "",
      githubUrl: account.profile?.githubUrl ?? "",
      portfolioUrl: account.profile?.portfolioUrl ?? "",
      resumeUrl: account.profile?.resumeUrl ?? "",
      visaNeedsSponsorship: account.profile?.visaNeedsSponsorship ?? false,
      salaryExpectationMin: account.profile?.salaryExpectationMin?.toString() ?? "",
      salaryExpectationMax: account.profile?.salaryExpectationMax?.toString() ?? "",
      skills: account.profile?.skills.map((skill) => skill.name).join(", ") ?? "",
      targetRoles: account.searchTargets.map((target) => target.title).join(", "),
      preferredLocations: account.searchLocations.map((location) => location.label).join(", "),
      preferredDomains: account.searchDomains
        .filter((domain) => domain.isValidated)
        .map((domain) => domain.label)
        .join(", "),
      searchKeywords: readStringArrayConstraint(account.profile?.constraints, "searchKeywords")
        .join(", "),
      preferencesNotes: readStringConstraint(account.profile?.constraints, "preferencesNotes"),
      languages: readStringArrayConstraint(account.profile?.constraints, "languages").join(", "),
      hasDrivingLicense: toLicenseChoice(
        readBooleanConstraint(account.profile?.constraints, "hasDrivingLicense"),
      ),
      mobilityRadiusKm:
        readNumberConstraint(account.profile?.constraints, "mobilityRadiusKm")?.toString() ?? "",
      excludedSectors: readStringArrayConstraint(account.profile?.constraints, "excludedSectors")
        .join(", "),
      employmentTypes:
        account.searchTargets[0]?.contractTypes.map((type) => type.toString()) ??
        readStringArrayConstraint(account.profile?.constraints, "employmentTypes"),
    },
  };
}
