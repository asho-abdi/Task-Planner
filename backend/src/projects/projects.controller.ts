import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
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
  AssignProjectDto,
  CreateFromTemplateDto,
  CreateProjectDto,
  ListProjectsQueryDto,
  MilestoneWriteDto,
  SaveTemplateDto,
  UpdateProjectDto,
  UpdateProjectMemberDto,
} from './dto/project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@WorkspaceScoped()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Query() query: ListProjectsQueryDto,
  ) {
    return this.projectsService.list(membership, query, user.id);
  }

  @Post()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  create(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(membership, user.id, dto);
  }

  @Get('templates')
  templates(@CurrentMembership() membership: WorkspaceMembershipContext) {
    return this.projectsService.listTemplates(membership);
  }

  @Post('from-template')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  fromTemplate(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFromTemplateDto,
  ) {
    return this.projectsService.createFromTemplate(membership, user.id, dto);
  }

  @Get(':projectId')
  getOne(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.findById(membership, projectId, user.id);
  }

  @Get(':projectId/timeline')
  timeline(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.timeline(membership, user.id, projectId);
  }

  @Get(':projectId/milestones')
  milestones(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.listMilestones(membership, user.id, projectId);
  }

  @Post(':projectId/milestones')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  createMilestone(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: MilestoneWriteDto,
  ) {
    return this.projectsService.createMilestone(
      membership,
      user.id,
      projectId,
      dto,
    );
  }

  @Patch(':projectId/milestones/:milestoneId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  updateMilestone(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: MilestoneWriteDto,
  ) {
    return this.projectsService.updateMilestone(
      membership,
      user.id,
      projectId,
      milestoneId,
      dto,
    );
  }

  @Delete(':projectId/milestones/:milestoneId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  removeMilestone(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
  ) {
    return this.projectsService.removeMilestone(
      membership,
      user.id,
      projectId,
      milestoneId,
    );
  }

  @Post(':projectId/save-template')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  saveTemplate(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: SaveTemplateDto,
  ) {
    return this.projectsService.saveAsTemplate(
      membership,
      user.id,
      projectId,
      dto,
    );
  }

  @Post(':projectId/assign')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  assign(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: AssignProjectDto,
  ) {
    return this.projectsService.assign(membership, user.id, projectId, dto);
  }

  @Get(':projectId/assignments')
  listAssignments(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.listAssignments(membership, projectId);
  }

  @Post(':projectId/assignments/confirm')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  confirmAssignment(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.confirmAssignment(
      membership,
      user.id,
      projectId,
    );
  }

  @Post(':projectId/assignments/return')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  returnAssignment(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.returnAssignment(
      membership,
      user.id,
      projectId,
    );
  }

  @Post(':projectId/assignments/complete')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  completeAssignment(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.completeAssignment(
      membership,
      user.id,
      projectId,
    );
  }

  @Patch(':projectId/members/:userId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  updateMemberRole(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateProjectMemberDto,
  ) {
    return this.projectsService.updateMemberRole(
      membership,
      user.id,
      projectId,
      userId,
      dto,
    );
  }

  @Delete(':projectId/members/:userId')
  @HttpCode(204)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  removeMember(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.projectsService.removeMember(
      membership,
      user.id,
      projectId,
      userId,
    );
  }

  @Patch(':projectId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  update(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(membership, projectId, dto, user.id);
  }

  @Post(':projectId/archive')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  archive(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.archive(membership, projectId, user.id);
  }

  @Delete(':projectId')
  @HttpCode(204)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  remove(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.remove(membership, projectId);
  }
}
