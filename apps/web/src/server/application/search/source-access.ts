import { isDeveloperEmail } from "@/lib/auth/developers";
import { db } from "@/server/infrastructure/prisma/client";

export type SearchSourceAccess = {
  linkedInDirect: boolean;
};

// The LinkedIn guest jobs endpoint is not a public API and LinkedIn's terms
// forbid automated access: it is limited to developer accounts, or to every
// account when ENABLE_LINKEDIN_DIRECT_SOURCE is explicitly set.
export async function resolveSearchSourceAccess(userId: string): Promise<SearchSourceAccess> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  return {
    linkedInDirect:
      process.env.ENABLE_LINKEDIN_DIRECT_SOURCE === "true" || isDeveloperEmail(user?.email),
  };
}
