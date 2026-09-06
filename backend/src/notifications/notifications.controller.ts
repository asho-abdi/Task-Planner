import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  CurrentMembership,
  CurrentUser,
  WorkspaceScoped,
} from '../common/decorators/workspace.decorators';
import type {
  AuthUser,
  WorkspaceMembershipContext,
} from '../common/types/request-context';
import { NotificationPrefsDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@WorkspaceScoped()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificationsService.list(user.id, membership.workspaceId);
  }

  @Post('read-all')
  markAllRead(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificationsService.markAllRead(
      user.id,
      membership.workspaceId,
    );
  }

  @Post(':notificationId/read')
  markRead(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markRead(
      user.id,
      membership.workspaceId,
      notificationId,
    );
  }

  @Get('preferences')
  getPrefs(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificationsService.getPrefs(user.id, membership.workspaceId);
  }

  @Patch('preferences')
  updatePrefs(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: NotificationPrefsDto,
  ) {
    return this.notificationsService.updatePrefs(
      user.id,
      membership.workspaceId,
      dto,
    );
  }
}
