import assert from "node:assert/strict";
import test from "node:test";

import { WorkspaceMemberRole } from "@prisma/client";

import {
  canEditWorkspaceMemberRole,
  canInviteToWorkspace,
} from "../../src/server/domain/authz/workspace-roles";

test("workspace invitation access is limited to owner and admin", () => {
  assert.equal(canInviteToWorkspace(WorkspaceMemberRole.OWNER), true);
  assert.equal(canInviteToWorkspace(WorkspaceMemberRole.ADMIN), true);
  assert.equal(canInviteToWorkspace(WorkspaceMemberRole.MEMBER), false);
  assert.equal(canInviteToWorkspace(WorkspaceMemberRole.BILLING), false);
});

test("admin cannot edit owner roles or promote to owner", () => {
  assert.equal(
    canEditWorkspaceMemberRole({
      actorRole: WorkspaceMemberRole.ADMIN,
      targetRole: WorkspaceMemberRole.OWNER,
      nextRole: WorkspaceMemberRole.MEMBER,
      isSelf: false,
    }),
    false,
  );

  assert.equal(
    canEditWorkspaceMemberRole({
      actorRole: WorkspaceMemberRole.ADMIN,
      targetRole: WorkspaceMemberRole.MEMBER,
      nextRole: WorkspaceMemberRole.OWNER,
      isSelf: false,
    }),
    false,
  );
});

test("owner can edit other members but not self", () => {
  assert.equal(
    canEditWorkspaceMemberRole({
      actorRole: WorkspaceMemberRole.OWNER,
      targetRole: WorkspaceMemberRole.MEMBER,
      nextRole: WorkspaceMemberRole.ADMIN,
      isSelf: false,
    }),
    true,
  );

  assert.equal(
    canEditWorkspaceMemberRole({
      actorRole: WorkspaceMemberRole.OWNER,
      targetRole: WorkspaceMemberRole.OWNER,
      nextRole: WorkspaceMemberRole.ADMIN,
      isSelf: true,
    }),
    false,
  );
});
