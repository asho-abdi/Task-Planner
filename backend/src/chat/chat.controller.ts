import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
  ConvertMessageDto,
  CreateChannelDto,
  ListMessagesQueryDto,
  OpenDirectDto,
  ReactMessageDto,
  SendMessageDto,
} from './dto/chat.dto';
import { ChatService } from './chat.service';

@Controller('chat')
@WorkspaceScoped()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  list(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chat.listConversations(membership, user.id);
  }

  @Post('channels')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  createChannel(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateChannelDto,
  ) {
    return this.chat.createChannel(membership, user.id, dto);
  }

  @Post('direct')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  openDirect(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: OpenDirectDto,
  ) {
    return this.chat.openDirect(membership, user.id, dto.userId);
  }

  @Get('projects/:projectId')
  project(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ) {
    return this.chat.projectConversation(membership, user.id, projectId);
  }

  @Get('conversations/:conversationId')
  getOne(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
  ) {
    return this.chat.getConversation(membership, user.id, conversationId);
  }

  @Get('conversations/:conversationId/messages')
  messages(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.chat.listMessages(membership, user.id, conversationId, query);
  }

  @Post('conversations/:conversationId/messages')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  send(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.sendMessage(membership, user.id, conversationId, dto);
  }

  @Post('conversations/:conversationId/read')
  read(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
  ) {
    return this.chat.markRead(membership, user.id, conversationId);
  }

  @Post('messages/:messageId/reactions')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  react(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('messageId') messageId: string,
    @Body() dto: ReactMessageDto,
  ) {
    return this.chat.react(membership, user.id, messageId, dto.emoji);
  }

  @Post('messages/:messageId/task')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  convert(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('messageId') messageId: string,
    @Body() dto: ConvertMessageDto,
  ) {
    return this.chat.convertToTask(membership, user.id, messageId, dto);
  }
}
