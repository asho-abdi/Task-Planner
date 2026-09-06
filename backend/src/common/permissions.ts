import { ForbiddenException } from '@nestjs/common';
import {
  ProjectMemberRole,
  TaskSharePermission,
  WorkspaceRole,
} from '@prisma/client';
import { WorkspaceMembershipContext } from './types/request-context';

export const WRITE_ROLES: WorkspaceRole[] = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
];

export const ADMIN_ROLES: WorkspaceRole[] = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
];

export function canMutate(role: WorkspaceRole): boolean {
  return WRITE_ROLES.includes(role);
}

export function canAdminister(role: WorkspaceRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function assertCanMutate(membership: WorkspaceMembershipContext): void {
  if (!canMutate(membership.role)) {
    throw new ForbiddenException('Insufficient workspace permissions');
  }
}

export function assertCanAdminister(
  membership: WorkspaceMembershipContext,
): void {
  if (!canAdminister(membership.role)) {
    throw new ForbiddenException('Insufficient workspace permissions');
  }
}

export type ProjectAccessLevel = 'NONE' | 'VIEW' | 'EDIT' | 'MANAGE' | 'OWN';

export function accessFromProjectRole(
  role: ProjectMemberRole | null | undefined,
): ProjectAccessLevel {
  if (role === ProjectMemberRole.OWNER) {
    return 'OWN';
  }
  if (role === ProjectMemberRole.MANAGER) {
    return 'MANAGE';
  }
  if (role === ProjectMemberRole.MEMBER) {
    return 'EDIT';
  }
  if (role === ProjectMemberRole.VIEWER) {
    return 'VIEW';
  }
  return 'NONE';
}

export function accessFromWorkspaceRole(
  role: WorkspaceRole,
): ProjectAccessLevel {
  if (role === WorkspaceRole.OWNER) {
    return 'OWN';
  }
  if (role === WorkspaceRole.ADMIN) {
    return 'MANAGE';
  }
  if (role === WorkspaceRole.MEMBER) {
    return 'EDIT';
  }
  return 'VIEW';
}

export function higherAccess(
  left: ProjectAccessLevel,
  right: ProjectAccessLevel,
): ProjectAccessLevel {
  const rank: Record<ProjectAccessLevel, number> = {
    NONE: 0,
    VIEW: 1,
    EDIT: 2,
    MANAGE: 3,
    OWN: 4,
  };
  return rank[left] >= rank[right] ? left : right;
}

export function canView(access: ProjectAccessLevel) {
  return access !== 'NONE';
}

export function canEditWork(access: ProjectAccessLevel) {
  return access === 'EDIT' || access === 'MANAGE' || access === 'OWN';
}

export function canManageProject(access: ProjectAccessLevel) {
  return access === 'MANAGE' || access === 'OWN';
}

export function canOwnProject(access: ProjectAccessLevel) {
  return access === 'OWN';
}

export function assertCanEditWork(access: ProjectAccessLevel) {
  if (!canEditWork(access)) {
    throw new ForbiddenException('You cannot edit this project');
  }
}

export function assertCanManageProject(access: ProjectAccessLevel) {
  if (!canManageProject(access)) {
    throw new ForbiddenException('You cannot manage this project');
  }
}

export function shareAllowsComment(permission: TaskSharePermission) {
  return (
    permission === TaskSharePermission.COMMENT ||
    permission === TaskSharePermission.EDIT
  );
}

export function shareAllowsEdit(permission: TaskSharePermission) {
  return permission === TaskSharePermission.EDIT;
}
