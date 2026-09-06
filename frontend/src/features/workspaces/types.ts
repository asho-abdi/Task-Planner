export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type Workspace = {
  id: string;
  name: string;
  slug?: string | null;
  description: string | null;
  logo?: string | null;
  createdAt: string;
  updatedAt: string;
  role: WorkspaceRole;
};

export type WorkspaceMember = {
  id: string;
  role: WorkspaceRole;
  userId: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
};

export type WorkspaceInvitation = {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: string;
  expiresAt: string;
  createdAt: string;
};

export type InviteResult = {
  invitation: WorkspaceInvitation;
  token: string;
};

export type InvitationPreview = {
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  workspace: { id: string; name: string };
};

export type MyInvitation = WorkspaceInvitation & {
  workspace: { id: string; name: string };
};
