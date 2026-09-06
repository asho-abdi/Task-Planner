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
import { Roles } from '../common/decorators/auth.decorators';
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
  AddTeamMemberDto,
  CreateTeamDto,
  UpdateTeamDto,
  UpdateTeamMemberDto,
} from './dto/team.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
@WorkspaceScoped()
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  list(@CurrentMembership() membership: WorkspaceMembershipContext) {
    return this.teamsService.list(membership);
  }

  @Post()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  create(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamsService.create(membership, user.id, dto);
  }

  @Get(':teamId')
  getOne(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('teamId') teamId: string,
  ) {
    return this.teamsService.findById(membership, teamId);
  }

  @Patch(':teamId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  update(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.update(membership, user.id, teamId, dto);
  }

  @Post(':teamId/members')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  addMember(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamsService.addMember(membership, user.id, teamId, dto);
  }

  @Patch(':teamId/members/:userId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  updateMemberRole(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.teamsService.updateMemberRole(
      membership,
      user.id,
      teamId,
      userId,
      dto,
    );
  }

  @Delete(':teamId/members/:userId')
  @HttpCode(204)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  async removeMember(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
  ) {
    await this.teamsService.removeMember(membership, user.id, teamId, userId);
  }
}
