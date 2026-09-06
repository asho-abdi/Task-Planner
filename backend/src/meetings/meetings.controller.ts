import {
  Body,
  Controller,
  Get,
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
  CalendarQueryDto,
  ConvertActionItemDto,
  CreateActionItemDto,
  CreateMeetingDto,
  ListMeetingsQueryDto,
  RsvpMeetingDto,
  UpdateActionItemDto,
  UpdateAgendaDto,
  UpdateMeetingDto,
} from './dto/meeting.dto';
import { MeetingsService } from './meetings.service';

@Controller()
@WorkspaceScoped()
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get('calendar')
  calendar(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Query() query: CalendarQueryDto,
  ) {
    return this.meetingsService.calendar(membership, query);
  }

  @Get('meetings')
  list(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Query() query: ListMeetingsQueryDto,
  ) {
    return this.meetingsService.list(membership, query);
  }

  @Post('meetings')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  create(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMeetingDto,
  ) {
    return this.meetingsService.create(membership, user.id, dto);
  }

  @Get('meetings/:meetingId')
  getOne(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.findById(membership, meetingId);
  }

  @Patch('meetings/:meetingId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  update(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.meetingsService.update(membership, user.id, meetingId, dto);
  }

  @Post('meetings/:meetingId/rsvp')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  rsvp(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
    @Body() dto: RsvpMeetingDto,
  ) {
    return this.meetingsService.rsvp(membership, user.id, meetingId, dto.response);
  }

  @Patch('meetings/:meetingId/agenda')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  agenda(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
    @Body() dto: UpdateAgendaDto,
  ) {
    return this.meetingsService.replaceAgenda(
      membership,
      user.id,
      meetingId,
      dto.agenda,
    );
  }

  @Post('meetings/:meetingId/action-items')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  createActionItem(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
    @Body() dto: CreateActionItemDto,
  ) {
    return this.meetingsService.createActionItem(
      membership,
      user.id,
      meetingId,
      dto,
    );
  }

  @Patch('meetings/:meetingId/action-items/:itemId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  updateActionItem(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateActionItemDto,
  ) {
    return this.meetingsService.updateActionItem(
      membership,
      user.id,
      meetingId,
      itemId,
      dto,
    );
  }

  @Post('meetings/:meetingId/action-items/:itemId/task')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  convertActionItem(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ConvertActionItemDto,
  ) {
    return this.meetingsService.convertActionItem(
      membership,
      user.id,
      meetingId,
      itemId,
      dto,
    );
  }

  @Post('meetings/:meetingId/cancel')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  cancel(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.cancel(membership, user.id, meetingId);
  }

  @Post('meetings/:meetingId/complete')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  complete(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.complete(membership, user.id, meetingId);
  }
}
