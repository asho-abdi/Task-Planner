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
  AssignTaskDto,
  ApplyScheduleDto,
  CreateCommentDto,
  CreateTaskDto,
  ListTasksQueryDto,
  ReturnTaskDto,
  ReviewSubmissionDto,
  ShareTaskDto,
  SubmitTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  UpdateTaskVisibilityDto,
} from './dto/task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@WorkspaceScoped()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasksService.list(membership, user.id, query);
  }

  @Post('schedule')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  applySchedule(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Body() dto: ApplyScheduleDto,
  ) {
    return this.tasksService.applySchedule(membership, dto);
  }

  @Post()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  create(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(membership, user.id, dto);
  }

  @Get(':taskId')
  getOne(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.findById(membership, taskId, user.id);
  }

  @Patch(':taskId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  update(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(membership, user.id, taskId, dto);
  }

  @Post(':taskId/assign')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  assign(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() dto: AssignTaskDto,
  ) {
    return this.tasksService.assign(membership, user.id, taskId, dto);
  }

  @Patch(':taskId/assign')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  assignPatch(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() dto: AssignTaskDto,
  ) {
    return this.tasksService.assign(membership, user.id, taskId, dto);
  }

  @Get(':taskId/shares')
  listShares(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.listShares(membership, user.id, taskId);
  }

  @Post(':taskId/shares')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  shareTask(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() dto: ShareTaskDto,
  ) {
    return this.tasksService.shareTask(membership, user.id, taskId, dto);
  }

  @Delete(':taskId/shares/:userId')
  @HttpCode(204)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  unshareTask(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Param('userId') userId: string,
  ) {
    return this.tasksService.unshareTask(
      membership,
      user.id,
      taskId,
      userId,
    );
  }

  @Patch(':taskId/visibility')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  updateVisibility(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskVisibilityDto,
  ) {
    return this.tasksService.updateVisibility(
      membership,
      user.id,
      taskId,
      dto,
    );
  }

  @Patch(':taskId/status')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  changeStatus(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.changeStatus(membership, user.id, taskId, dto);
  }

  @Post(':taskId/archive')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  archive(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.archive(membership, taskId);
  }

  @Post(':taskId/comments')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  addComment(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.tasksService.addComment(membership, user.id, taskId, dto);
  }

  @Get(':taskId/comments')
  listComments(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.listComments(membership, taskId);
  }

  @Post(':taskId/comments/:commentId/reactions')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  reactToComment(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Body() dto: { emoji: string },
  ) {
    return this.tasksService.reactToComment(
      membership,
      user.id,
      taskId,
      commentId,
      dto.emoji,
    );
  }

  @Get(':taskId/subtasks')
  listSubtasks(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.listSubtasks(membership, taskId);
  }

  @Post(':taskId/submit')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  submit(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() dto: SubmitTaskDto,
  ) {
    return this.tasksService.submit(membership, user.id, taskId, dto);
  }

  @Post(':taskId/submissions')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  submitWork(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() dto: SubmitTaskDto,
  ) {
    return this.tasksService.submit(membership, user.id, taskId, dto);
  }

  @Post(':taskId/return')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  returnToLeader(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() dto: ReturnTaskDto,
  ) {
    return this.tasksService.returnToLeader(membership, user.id, taskId, dto);
  }

  @Post(':taskId/review')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  review(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() dto: ReviewSubmissionDto,
  ) {
    return this.tasksService.review(membership, user.id, taskId, dto);
  }

  @Post(':taskId/time/start')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  startTimer(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.startTimer(membership, user.id, taskId);
  }

  @Post(':taskId/time/stop')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  stopTimer(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.stopTimer(membership, user.id, taskId);
  }

  @Delete(':taskId')
  @HttpCode(204)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  remove(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.remove(membership, user.id, taskId);
  }
}
