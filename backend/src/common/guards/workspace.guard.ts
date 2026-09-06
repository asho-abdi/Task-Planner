import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WORKSPACE_HEADER } from '../constants';
import { Role, WorkspaceMemberStatus, WorkspaceRole } from '@prisma/client';
import { AuthenticatedRequest } from '../types/request-context';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication is required');
    }

    const workspaceId = this.resolveWorkspaceId(request);
    if (!workspaceId) {
      throw new ForbiddenException('Workspace context is required');
    }

    if (user.role === Role.SUPER_ADMIN) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      });
      if (!workspace) {
        throw new ForbiddenException('Workspace not found');
      }
      request.workspaceMembership = {
        workspaceId,
        memberId: 'super-admin',
        role: WorkspaceRole.OWNER,
      };
      return true;
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id,
        },
      },
      select: {
        id: true,
        workspaceId: true,
        role: true,
        status: true,
      },
    });

    if (!membership || membership.status !== WorkspaceMemberStatus.ACTIVE) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    request.workspaceMembership = {
      workspaceId: membership.workspaceId,
      memberId: membership.id,
      role: membership.role,
    };

    return true;
  }

  private resolveWorkspaceId(
    request: AuthenticatedRequest,
  ): string | undefined {
    const fromParams = request.params.workspaceId;
    if (fromParams) {
      return fromParams;
    }

    const header = request.headers[WORKSPACE_HEADER];
    return Array.isArray(header) ? header[0] : header;
  }
}
