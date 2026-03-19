import { db } from "@/lib/db";
import {
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

export function mapAccountToProfileDraft(
  account: NonNullable<Awaited<ReturnType<typeof getProfileFormData>>>,
) {
  return {
    fullName: account.fullName ?? "",
    email: account.email,
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
      employmentTypes:
        account.searchTargets[0]?.contractTypes.map((type) => type.toString()) ??
        readStringArrayConstraint(account.profile?.constraints, "employmentTypes"),
    },
  };
}
