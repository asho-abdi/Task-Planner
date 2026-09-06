import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { Public } from '../common/decorators/auth.decorators';
import {
  CurrentMembership,
  CurrentUser,
  WorkspaceScoped,
} from '../common/decorators/workspace.decorators';
import type {
  AuthUser,
  WorkspaceMembershipContext,
} from '../common/types/request-context';
import {
  AcceptInvitationDto,
  CreateWorkspaceDto,
  DeclineInvitationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  UpdateWorkspaceDto,
} from './dto/workspace.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.workspacesService.listForUser(user.id);
  }

  @Public()
  @Get('invitations/preview/:token')
  previewInvitation(@Param('token') token: string) {
    return this.workspacesService.previewInvitation(token);
  }

  @Get('invitations/mine')
  listMyInvitations(@CurrentUser() user: AuthUser) {
    return this.workspacesService.listMyInvitations(user.email);
  }

  @Post('invitations/accept')
  acceptInvitation(
    @CurrentUser() user: AuthUser,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.workspacesService.acceptInvitation(
      user.id,
      user.email,
      dto.token,
    );
  }

  @Post('invitations/accept/:invitationId')
  acceptMyInvitation(
    @CurrentUser() user: AuthUser,
    @Param('invitationId') invitationId: string,
  ) {
    return this.workspacesService.acceptMyInvitation(
      user.id,
      user.email,
      invitationId,
    );
  }

  @Post('invitations/decline')
  declineInvitation(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeclineInvitationDto,
  ) {
    return this.workspacesService.declineInvitation(user.email, dto);
  }

  @Get(':workspaceId')
  @WorkspaceScoped()
  getOne(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workspacesService.findByIdForUser(workspaceId, user.id);
  }

  @Patch(':workspaceId')
  @WorkspaceScoped(WorkspaceRole.OWNER)
  update(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(workspaceId, dto);
  }

  @Get(':workspaceId/members')
  @WorkspaceScoped()
  listMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.listMembers(workspaceId);
  }

  @Patch(':workspaceId/members/:userId')
  @WorkspaceScoped(WorkspaceRole.OWNER)
  updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspacesService.updateMemberRole(
      workspaceId,
      { id: user.id, role: membership.role },
      userId,
      dto,
    );
  }

  @Delete(':workspaceId/members/:userId')
  @HttpCode(204)
  @WorkspaceScoped(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
    @CurrentMembership() membership: WorkspaceMembershipContext,
  ) {
    return this.workspacesService.removeMember(
      workspaceId,
      { id: user.id, role: membership.role },
      userId,
    );
  }

  @Get(':workspaceId/invitations')
  @WorkspaceScoped(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  listInvitations(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.listInvitations(workspaceId);
  }

  @Post(':workspaceId/invitations')
  @WorkspaceScoped(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  invite(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthUser,
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspacesService.invite(
      workspaceId,
      user.id,
      membership.role,
      dto,
    );
  }

  @Post(':workspaceId/invitations/:invitationId/resend')
  @WorkspaceScoped(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  resendInvitation(
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.workspacesService.resendInvitation(workspaceId, invitationId);
  }

  @Post(':workspaceId/invitations/:invitationId/revoke')
  @HttpCode(204)
  @WorkspaceScoped(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  revokeInvitation(
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.workspacesService.revokeInvitation(workspaceId, invitationId);
  }
}
