import { AppJobType } from "@prisma/client";

import type { AuthenticatedViewer } from "../src/lib/auth/viewer";
import { hashPassword } from "../src/lib/auth/password";
import { db } from "../src/lib/db";
import { saveProfileOnboarding } from "../src/lib/profile/onboarding";
import {
  buildPersonaEmail,
  buildPersonaFullName,
  buildPersonaOnboardingPayload,
  personaSeedPassword,
  testPersonas,
  type TestPersona,
} from "../src/lib/testing/personas";
import { refreshUserSearchProfileInference } from "../src/server/application/personalization/profile-inference-service";
import { ensureUserWorkspace } from "../src/server/application/workspace/workspace-service";

type SeededPersonaSummary = {
  slug: string;
  fullName: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
};

function buildViewer(
  input: {
    userId: string;
    email: string;
    fullName: string;
  },
  workspace: Awaited<ReturnType<typeof ensureUserWorkspace>>,
): AuthenticatedViewer {
  return {
    userId: input.userId,
    email: input.email,
    fullName: input.fullName,
    workspaceId: workspace.workspaceId,
    workspaceSlug: workspace.slug,
    workspaceName: workspace.name,
    workspaceRole: workspace.role,
  };
}

async function seedPersona(persona: TestPersona): Promise<SeededPersonaSummary> {
  const email = buildPersonaEmail(persona);
  const fullName = buildPersonaFullName(persona);
  const passwordHash = await hashPassword(personaSeedPassword);

  const user = await db.user.upsert({
    where: {
      email,
    },
    update: {
      fullName,
      passwordHash,
    },
    create: {
      email,
      fullName,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  });

  const workspace = await ensureUserWorkspace(user.id);
  const viewer = buildViewer(
    {
      userId: user.id,
      email: user.email,
      fullName: user.fullName ?? fullName,
    },
    workspace,
  );

  await saveProfileOnboarding(viewer, buildPersonaOnboardingPayload(persona));
  await refreshUserSearchProfileInference(user.id, workspace.workspaceId);

  await db.appJob.deleteMany({
    where: {
      userId: user.id,
      workspaceId: workspace.workspaceId,
      type: AppJobType.PROFILE_ENRICHMENT_REFRESH,
    },
  });

  return {
    slug: persona.slug,
    fullName,
    email,
    workspaceId: workspace.workspaceId,
    workspaceName: workspace.name,
  };
}

async function main() {
  const seeded = [];

  for (const persona of testPersonas) {
    seeded.push(await seedPersona(persona));
  }

  console.log(
    JSON.stringify(
      {
        password: personaSeedPassword,
        personas: seeded,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
