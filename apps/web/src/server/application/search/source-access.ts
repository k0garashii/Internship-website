import { WorkspaceFeature } from "@prisma/client";

import { isDeveloperEmail } from "@/lib/auth/developers";
import { getWorkspaceFeatureAccess } from "@/server/application/entitlements/entitlement-service";
import { getRequiredActiveWorkspaceIdForUser } from "@/server/application/workspace/workspace-service";
import { db } from "@/server/infrastructure/prisma/client";

export type SearchSourceAccess = {
  linkedInDirect: boolean;
  extendedSources: boolean;
};

export async function resolveSearchSourceAccess(
  userId: string,
  workspaceId?: string | null,
): Promise<SearchSourceAccess> {
  const [user, extendedSources] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    }),
    getWorkspaceFeatureAccess(
      workspaceId ?? (await getRequiredActiveWorkspaceIdForUser(userId)),
      WorkspaceFeature.EXTENDED_SOURCES,
    ),
  ]);

  return {
    // The LinkedIn guest jobs endpoint is not a public API and LinkedIn's terms
    // forbid automated access: developer accounts only, unless explicitly
    // enabled for everyone.
    linkedInDirect:
      process.env.ENABLE_LINKEDIN_DIRECT_SOURCE === "true" || isDeveloperEmail(user?.email),
    // Official sources (France Travail) are part of the Pro plan.
    extendedSources: extendedSources.enabled,
  };
}
