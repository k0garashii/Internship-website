import { WorkspaceMemberRole } from "@prisma/client";

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceMemberRole, string> = {
  [WorkspaceMemberRole.OWNER]: "Owner",
  [WorkspaceMemberRole.ADMIN]: "Admin",
  [WorkspaceMemberRole.MEMBER]: "Member",
  [WorkspaceMemberRole.BILLING]: "Billing",
};

export function canManageWorkspace(role: WorkspaceMemberRole | null | undefined) {
  return role === WorkspaceMemberRole.OWNER || role === WorkspaceMemberRole.ADMIN;
}

export function canInviteToWorkspace(role: WorkspaceMemberRole | null | undefined) {
  return canManageWorkspace(role);
}

export function canEditWorkspaceMemberRole(input: {
  actorRole: WorkspaceMemberRole | null | undefined;
  targetRole: WorkspaceMemberRole;
  nextRole: WorkspaceMemberRole;
  isSelf: boolean;
}) {
  if (!canManageWorkspace(input.actorRole)) {
    return false;
  }

  if (input.isSelf) {
    return false;
  }

  if (input.actorRole === WorkspaceMemberRole.ADMIN) {
    if (
      input.targetRole === WorkspaceMemberRole.OWNER ||
      input.nextRole === WorkspaceMemberRole.OWNER
    ) {
      return false;
    }
  }

  return true;
}
