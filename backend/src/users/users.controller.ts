import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/workspace.decorators';
import { SystemRoles } from '../common/decorators/system-roles.decorator';
import { SystemRolesGuard } from '../common/guards/system-roles.guard';
import type { AuthUser } from '../common/types/request-context';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() authUser: AuthUser) {
    const user = await this.usersService.findByIdOrThrow(authUser.id);
    return this.usersService.toPublicUser(user);
  }

  @Get()
  @UseGuards(SystemRolesGuard)
  @SystemRoles(Role.SUPER_ADMIN, Role.ADMIN)
  list() {
    return this.usersService.listPlatformUsers();
  }
}
