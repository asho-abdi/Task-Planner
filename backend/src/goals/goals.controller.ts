import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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
import { CreateGoalDto, UpdateGoalDto } from './dto/goal.dto';
import { GoalsService } from './goals.service';

@Controller('goals')
@WorkspaceScoped()
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  list(@CurrentMembership() membership: WorkspaceMembershipContext) {
    return this.goalsService.list(membership);
  }

  @Post()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  create(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGoalDto,
  ) {
    return this.goalsService.create(membership, user.id, dto);
  }

  @Get(':goalId')
  getOne(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('goalId') goalId: string,
  ) {
    return this.goalsService.findById(membership, goalId);
  }

  @Patch(':goalId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  update(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('goalId') goalId: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(membership, goalId, dto);
  }
}
