import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, WorkspaceMemberStatus, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceGuard } from './workspace.guard';

describe('WorkspaceGuard', () => {
  let guard: WorkspaceGuard;
  const prisma = {
    workspaceMember: {
      findUnique: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    prisma.workspaceMember.findUnique.mockReset();
    prisma.workspace.findUnique.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkspaceGuard, { provide: PrismaService, useValue: prisma }],
    }).compile();
    guard = module.get(WorkspaceGuard);
  });

  function context(
    userId?: string,
    workspaceId?: string,
    headerWorkspaceId?: string,
    role?: Role,
  ) {
    const request = {
      user: userId ? { id: userId, email: 'a@b.com', role } : undefined,
      params: { workspaceId },
      headers: headerWorkspaceId ? { 'x-workspace-id': headerWorkspaceId } : {},
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      request,
    };
  }

  it('rejects requests without a verified membership', async () => {
    const ctx = context('user-1', 'ws-1');
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('does not trust workspaceId unless membership is active', async () => {
    const ctx = context('user-1', 'ws-1');
    prisma.workspaceMember.findUnique.mockResolvedValue({
      id: 'mem-1',
      workspaceId: 'ws-1',
      role: WorkspaceRole.MEMBER,
      status: WorkspaceMemberStatus.SUSPENDED,
    });

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('attaches membership when the user belongs to the workspace', async () => {
    const ctx = context('user-1', 'ws-1');
    prisma.workspaceMember.findUnique.mockResolvedValue({
      id: 'mem-1',
      workspaceId: 'ws-1',
      role: WorkspaceRole.ADMIN,
      status: WorkspaceMemberStatus.ACTIVE,
    });

    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(ctx.request.workspaceMembership).toEqual({
      workspaceId: 'ws-1',
      memberId: 'mem-1',
      role: WorkspaceRole.ADMIN,
    });
  });

  it('resolves workspace context from the x-workspace-id header', async () => {
    const ctx = context('user-1', undefined, 'ws-header');
    prisma.workspaceMember.findUnique.mockResolvedValue({
      id: 'mem-1',
      workspaceId: 'ws-header',
      role: WorkspaceRole.MEMBER,
      status: WorkspaceMemberStatus.ACTIVE,
    });

    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId_userId: { workspaceId: 'ws-header', userId: 'user-1' },
        },
      }),
    );
  });

  it('lets a system super admin act in any existing workspace', async () => {
    const ctx = context('user-1', 'ws-1', undefined, Role.SUPER_ADMIN);
    prisma.workspace.findUnique.mockResolvedValue({ id: 'ws-1' });

    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(ctx.request.workspaceMembership).toEqual({
      workspaceId: 'ws-1',
      memberId: 'super-admin',
      role: WorkspaceRole.OWNER,
    });
    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });
});
