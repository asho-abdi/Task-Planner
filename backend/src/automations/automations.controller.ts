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
  CreateAutomationDto,
  UpdateAutomationDto,
} from './dto/automation.dto';
import { AutomationsService } from './automations.service';

@Controller('automations')
@WorkspaceScoped()
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get()
  list(@CurrentMembership() membership: WorkspaceMembershipContext) {
    return this.automationsService.list(membership);
  }

  @Post()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  create(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAutomationDto,
  ) {
    return this.automationsService.create(membership, user.id, dto);
  }

  @Patch(':automationId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  update(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('automationId') automationId: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.automationsService.update(membership, automationId, dto);
  }

  @Delete(':automationId')
  @HttpCode(204)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  remove(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('automationId') automationId: string,
  ) {
    return this.automationsService.remove(membership, automationId);
  }
}
