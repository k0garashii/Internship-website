import {
  DomainSource,
  EmploymentType,
  ExperienceLevel,
  TargetSource,
  WorkMode,
} from "@prisma/client";

import { db } from "@/lib/db";
import type { AuthenticatedViewer } from "@/lib/auth/viewer";
import { assertAuthenticatedViewer } from "@/lib/auth/viewer";
import {
  buildProfileConstraints,
  normalizeListItem,
  profileOnboardingSchema,
  slugify,
  splitMultilineOrCommaList,
  type ProfileOnboardingInput,
} from "@/lib/profile/schema";

export class ProfileOnboardingError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ProfileOnboardingError";
  }
}
export async function saveProfileOnboarding(
  viewer: AuthenticatedViewer,
  input: unknown,
) {
  const authenticatedViewer = assertAuthenticatedViewer(viewer);
  const parsed = profileOnboardingSchema.safeParse(input);

  if (!parsed.success) {
    throw new ProfileOnboardingError(
      "Invalid onboarding payload",
      400,
      parsed.error.flatten().fieldErrors,
    );
  }

  const data = parsed.data;
  const skills = splitMultilineOrCommaList(data.skills);
  const targetRoles = splitMultilineOrCommaList(data.targetRoles);
  const preferredLocations = splitMultilineOrCommaList(data.preferredLocations);
  const preferredDomains = splitMultilineOrCommaList(data.preferredDomains);
  const validatedDomainSelections =
    data.domainSelections && data.domainSelections.length > 0
      ? Array.from(
          new Map(
            data.domainSelections
              .filter((domain) => domain.isValidated)
              .map((domain) => {
                const label = normalizeListItem(domain.label);
                const normalizedLabel = slugify(label);

                return [
                  normalizedLabel,
                  {
                    label,
                    normalizedLabel,
                    rationale: domain.rationale ? normalizeListItem(domain.rationale) : null,
                    source:
                      domain.source === "GEMINI" ? DomainSource.GEMINI : DomainSource.MANUAL,
                  },
                ] as const;
              })
              .filter(([normalizedLabel]) => Boolean(normalizedLabel)),
          ).values(),
        )
      : preferredDomains.map((domain) => ({
          label: domain,
          normalizedLabel: slugify(domain),
          rationale: "Defined during onboarding",
          source: DomainSource.MANUAL,
        }));

  if (
    data.salaryExpectationMin !== null &&
    data.salaryExpectationMax !== null &&
    data.salaryExpectationMin > data.salaryExpectationMax
  ) {
    throw new ProfileOnboardingError("Salary range is invalid", 400, {
      salaryExpectationMin: ["Minimum salary must be below maximum salary"],
      salaryExpectationMax: ["Maximum salary must be above minimum salary"],
    });
  }

  if (
    data.availabilityDate &&
    data.availabilityEndDate &&
    Date.parse(data.availabilityEndDate) < Date.parse(data.availabilityDate)
  ) {
    throw new ProfileOnboardingError("Availability window is invalid", 400, {
      availabilityDate: ["Start date must be before end date"],
      availabilityEndDate: ["End date must be after start date"],
    });
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: authenticatedViewer.userId,
      },
      data: {
        fullName: data.fullName,
      },
    });

    const profile = await tx.userProfile.upsert({
      where: {
        userId: authenticatedViewer.userId,
      },
      update: {
        headline: data.headline || null,
        summary: data.summary || null,
        school: data.school || null,
        degree: data.degree || null,
        graduationYear: data.graduationYear,
        city: data.city || null,
        countryCode: data.countryCode || null,
        remotePreference: data.remotePreference as WorkMode | null,
        experienceLevel: data.experienceLevel as ExperienceLevel | null,
        availabilityDate: data.availabilityDate ? new Date(data.availabilityDate) : null,
        linkedinUrl: data.linkedinUrl || null,
        githubUrl: data.githubUrl || null,
        portfolioUrl: data.portfolioUrl || null,
        resumeUrl: data.resumeUrl || null,
        visaNeedsSponsorship: data.visaNeedsSponsorship,
        salaryExpectationMin: data.salaryExpectationMin,
        salaryExpectationMax: data.salaryExpectationMax,
        constraints: buildProfileConstraints(data),
      },
      create: {
        userId: authenticatedViewer.userId,
        headline: data.headline || null,
        summary: data.summary || null,
        school: data.school || null,
        degree: data.degree || null,
        graduationYear: data.graduationYear,
        city: data.city || null,
        countryCode: data.countryCode || null,
        remotePreference: data.remotePreference as WorkMode | null,
        experienceLevel: data.experienceLevel as ExperienceLevel | null,
        availabilityDate: data.availabilityDate ? new Date(data.availabilityDate) : null,
        linkedinUrl: data.linkedinUrl || null,
        githubUrl: data.githubUrl || null,
        portfolioUrl: data.portfolioUrl || null,
        resumeUrl: data.resumeUrl || null,
        visaNeedsSponsorship: data.visaNeedsSponsorship,
        salaryExpectationMin: data.salaryExpectationMin,
        salaryExpectationMax: data.salaryExpectationMax,
        constraints: buildProfileConstraints(data),
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

    if (skills.length > 0) {
      await tx.profileSkill.createMany({
        data: skills.map((skill, index) => ({
          profileId: profile.id,
          name: skill,
          normalizedName: slugify(skill),
          isHighlighted: index < 5,
        })),
      });
    }

    await tx.searchTarget.deleteMany({
      where: {
        userId: authenticatedViewer.userId,
      },
    });

    if (targetRoles.length > 0) {
      await tx.searchTarget.createMany({
        data: targetRoles.map((target, index) => ({
          userId: authenticatedViewer.userId,
          title: target,
          normalizedTitle: slugify(target),
          source: TargetSource.MANUAL,
          priority: Math.max(100 - index * 10, 10),
          contractTypes: data.employmentTypes,
          isActive: true,
        })),
      });
    }

    await tx.searchLocation.deleteMany({
      where: {
        userId: authenticatedViewer.userId,
      },
    });

    if (preferredLocations.length > 0) {
      await tx.searchLocation.createMany({
        data: preferredLocations.map((location, index) => ({
          userId: authenticatedViewer.userId,
          label: location,
          normalizedLabel: slugify(location),
          countryCode: data.countryCode || null,
          isRemote: data.remotePreference === WorkMode.REMOTE,
          isHybrid: data.remotePreference === WorkMode.HYBRID,
          priority: Math.max(100 - index * 10, 10),
        })),
      });
    }

    await tx.searchDomain.deleteMany({
      where: {
        userId: authenticatedViewer.userId,
      },
    });

    if (validatedDomainSelections.length > 0) {
      await tx.searchDomain.createMany({
        data: validatedDomainSelections.map((domain) => ({
          userId: authenticatedViewer.userId,
          label: domain.label,
          normalizedLabel: domain.normalizedLabel,
          source: domain.source,
          rationale:
            domain.rationale ??
            (domain.source === DomainSource.GEMINI
              ? "Validated after Gemini bootstrap"
              : "Defined during onboarding"),
          isValidated: true,
        })),
      });
    }
  });

  return {
    savedAt: new Date().toISOString(),
    normalizedUrls: {
      linkedinUrl: data.linkedinUrl,
      githubUrl: data.githubUrl,
      portfolioUrl: data.portfolioUrl,
      resumeUrl: data.resumeUrl,
    },
  };
}
