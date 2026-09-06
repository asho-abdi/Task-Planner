import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { Roles } from './auth.decorators';
import { RolesGuard } from '../guards/roles.guard';
import { WorkspaceGuard } from '../guards/workspace.guard';
import {
  AuthenticatedRequest,
  AuthUser,
  WorkspaceMembershipContext,
} from '../types/request-context';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);

export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceMembershipContext => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.workspaceMembership) {
      throw new ForbiddenException(
        'Workspace membership is missing from the request',
      );
    }
    return request.workspaceMembership;
  },
);

export function WorkspaceScoped(...roles: WorkspaceRole[]) {
  return applyDecorators(
    UseGuards(WorkspaceGuard, RolesGuard),
    ...(roles.length > 0 ? [Roles(...roles)] : []),
  );
}
