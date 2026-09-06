import { Role, WorkspaceRole } from '@prisma/client';

export type AuthUser = {
  id: string;
  email: string;
  role?: Role;
};

export type WorkspaceMembershipContext = {
  workspaceId: string;
  memberId: string;
  role: WorkspaceRole;
};

export type AuthenticatedRequest = {
  user: AuthUser;
  workspaceMembership?: WorkspaceMembershipContext;
  params: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
};
