import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { SYSTEM_ROLES_KEY } from '../decorators/system-roles.decorator';
import { AuthenticatedRequest } from '../types/request-context';
import { UsersService } from '../../users/users.service';

@Injectable()
export class SystemRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<Role[]>(SYSTEM_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new ForbiddenException('Authentication is required');
    }

    const user = await this.usersService.findByIdOrThrow(request.user.id);
    if (!roles.includes(user.role)) {
      throw new ForbiddenException('Insufficient system permissions');
    }
    return true;
  }
}
