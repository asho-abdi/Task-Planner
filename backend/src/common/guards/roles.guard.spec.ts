import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/auth.decorators';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  function context(role?: WorkspaceRole) {
    const request = {
      workspaceMembership: role
        ? { workspaceId: 'ws-1', memberId: 'mem-1', role }
        : undefined,
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
  }

  beforeEach(() => {
    reflector.getAllAndOverride.mockReset();
  });

  it('allows the request when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(context(WorkspaceRole.VIEWER) as never)).toBe(
      true,
    );
  });

  it('rejects VIEWER when write roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue([
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
    ]);
    expect(() =>
      guard.canActivate(context(WorkspaceRole.VIEWER) as never),
    ).toThrow(ForbiddenException);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('allows MEMBER when write roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue([
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
    ]);
    expect(guard.canActivate(context(WorkspaceRole.MEMBER) as never)).toBe(
      true,
    );
  });
});
