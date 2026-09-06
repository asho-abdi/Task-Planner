import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  StreamableFile,
} from '@nestjs/common';
import { ActivityType, ChatKind, ChatPrivacy, TaskVisibility } from '@prisma/client';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { copyFile, unlink } from 'fs/promises';
import { extname, join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { assertCanMutate, canAdminister, canView } from '../common/permissions';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { ConfigService } from '@nestjs/config';
import { ActivityService } from '../activity/activity.service';
import { ProjectsService } from '../projects/projects.service';

const MAX_BYTES = 10 * 1024 * 1024;

const fileSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  taskId: true,
  projectId: true,
  meetingId: true,
  teamId: true,
  pageId: true,
  conversationId: true,
  commentId: true,
  messageId: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true, email: true } },
} as const;

export type FileAttach = {
  taskId?: string | null;
  projectId?: string | null;
  meetingId?: string | null;
  teamId?: string | null;
  pageId?: string | null;
  conversationId?: string | null;
  commentId?: string | null;
  messageId?: string | null;
};

@Injectable()
export class FilesService {
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    @Optional() private readonly activity?: ActivityService,
    @Optional() private readonly projects?: ProjectsService,
  ) {
    this.uploadDir =
      config.get<string>('uploadDir') ?? join(process.cwd(), 'uploads');
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async list(
    membership: WorkspaceMembershipContext,
    userId: string,
    query: FileAttach,
  ) {
    const files = await this.prisma.workspaceFile.findMany({
      where: {
        workspaceId: membership.workspaceId,
        ...(query.taskId ? { taskId: query.taskId } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.meetingId ? { meetingId: query.meetingId } : {}),
        ...(query.teamId ? { teamId: query.teamId } : {}),
        ...(query.pageId ? { pageId: query.pageId } : {}),
        ...(query.conversationId ? { conversationId: query.conversationId } : {}),
        ...(query.commentId ? { commentId: query.commentId } : {}),
        ...(query.messageId ? { messageId: query.messageId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: fileSelect,
    });
    const visible = [];
    for (const file of files) {
      if (await this.canAccess(membership, userId, file)) {
        visible.push(file);
      }
    }
    return visible;
  }

  async upload(
    membership: WorkspaceMembershipContext,
    userId: string,
    file: Express.Multer.File | undefined,
    attach: FileAttach,
  ) {
    assertCanMutate(membership);
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('File exceeds the 10MB limit');
    }

    await this.assertAttachTargets(membership, userId, attach);

    const storedName = `${randomUUID()}${extname(file.originalname).slice(0, 16)}`;
    const dest = join(this.uploadDir, storedName);
    await copyFile(file.path, dest);
    await unlink(file.path).catch(() => undefined);

    const record = await this.prisma.workspaceFile.create({
      data: {
        workspaceId: membership.workspaceId,
        uploadedById: userId,
        filename: storedName,
        originalName: file.originalname.slice(0, 255),
        mimeType: file.mimetype.slice(0, 180) || 'application/octet-stream',
        sizeBytes: file.size,
        taskId: attach.taskId ?? null,
        projectId: attach.projectId ?? null,
        meetingId: attach.meetingId ?? null,
        teamId: attach.teamId ?? null,
        pageId: attach.pageId ?? null,
        conversationId: attach.conversationId ?? null,
        commentId: attach.commentId ?? null,
        messageId: attach.messageId ?? null,
      },
      select: fileSelect,
    });
    await this.activity?.log({
      workspaceId: membership.workspaceId,
      actorId: userId,
      type: ActivityType.FILE_UPLOADED,
      title: `uploaded ${record.originalName}`,
      entityType: 'file',
      entityId: record.id,
    });
    return record;
  }

  async download(
    membership: WorkspaceMembershipContext,
    userId: string,
    fileId: string,
  ) {
    const record = await this.requireAccessible(membership, userId, fileId);
    const path = this.safePath(record.filename);
    if (!existsSync(path)) {
      throw new NotFoundException('File contents are missing');
    }
    return {
      file: new StreamableFile(createReadStream(path)),
      originalName: record.originalName,
      mimeType: record.mimeType,
    };
  }

  async rename(
    membership: WorkspaceMembershipContext,
    userId: string,
    fileId: string,
    originalName: string,
  ) {
    assertCanMutate(membership);
    const record = await this.requireAccessible(membership, userId, fileId);
    this.assertCanManageFile(membership, userId, record);
    return this.prisma.workspaceFile.update({
      where: { id: record.id },
      data: { originalName: originalName.trim().slice(0, 255) },
      select: fileSelect,
    });
  }

  async move(
    membership: WorkspaceMembershipContext,
    userId: string,
    fileId: string,
    attach: FileAttach,
  ) {
    assertCanMutate(membership);
    const record = await this.requireAccessible(membership, userId, fileId);
    this.assertCanManageFile(membership, userId, record);
    await this.assertAttachTargets(membership, userId, attach);
    return this.prisma.workspaceFile.update({
      where: { id: record.id },
      data: {
        taskId: attach.taskId ?? null,
        projectId: attach.projectId ?? null,
        meetingId: attach.meetingId ?? null,
        teamId: attach.teamId ?? null,
        pageId: attach.pageId ?? null,
        conversationId: attach.conversationId ?? null,
        commentId: attach.commentId ?? null,
        messageId: attach.messageId ?? null,
      },
      select: fileSelect,
    });
  }

  async remove(
    membership: WorkspaceMembershipContext,
    userId: string,
    fileId: string,
  ) {
    assertCanMutate(membership);
    const record = await this.requireAccessible(membership, userId, fileId);
    this.assertCanManageFile(membership, userId, record);
    await this.prisma.workspaceFile.delete({ where: { id: record.id } });
    const path = this.safePath(record.filename);
    await unlink(path).catch(() => undefined);
  }

  private async requireAccessible(
    membership: WorkspaceMembershipContext,
    userId: string,
    fileId: string,
  ) {
    const record = await this.prisma.workspaceFile.findFirst({
      where: { id: fileId, workspaceId: membership.workspaceId },
    });
    if (!record) {
      throw new NotFoundException('File not found');
    }
    if (!(await this.canAccess(membership, userId, record))) {
      throw new ForbiddenException('You cannot access this file');
    }
    return record;
  }

  private assertCanManageFile(
    membership: WorkspaceMembershipContext,
    userId: string,
    record: { uploadedById: string },
  ) {
    if (!canAdminister(membership.role) && record.uploadedById !== userId) {
      throw new ForbiddenException('You can only change files you uploaded');
    }
  }

  private safePath(filename: string) {
    const resolved = resolve(this.uploadDir, filename);
    if (!resolved.startsWith(resolve(this.uploadDir))) {
      throw new BadRequestException('Invalid file path');
    }
    return resolved;
  }

  private async canAccess(
    membership: WorkspaceMembershipContext,
    userId: string,
    file: FileAttach & { id?: string },
  ) {
    if (file.conversationId) {
      const conversation = await this.prisma.chatConversation.findFirst({
        where: {
          id: file.conversationId,
          workspaceId: membership.workspaceId,
        },
        select: {
          privacy: true,
          kind: true,
          members: { where: { userId }, select: { id: true } },
        },
      });
      if (!conversation) return false;
      if (
        conversation.privacy === ChatPrivacy.PUBLIC &&
        conversation.kind === ChatKind.CHANNEL
      ) {
        return true;
      }
      return conversation.members.length > 0;
    }
    if (file.projectId && this.projects) {
      const access = await this.projects.resolveAccess(
        membership,
        userId,
        file.projectId,
      );
      if (!canView(access)) return false;
    }
    if (file.teamId) {
      const member = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: file.teamId, userId } },
        select: { id: true },
      });
      if (!member && !canAdminister(membership.role)) {
        return false;
      }
    }
    if (file.taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: file.taskId, workspaceId: membership.workspaceId },
        select: {
          visibility: true,
          ownerId: true,
          assignedById: true,
          projectId: true,
          assignees: { where: { userId }, select: { id: true } },
          shares: { where: { userId }, select: { id: true } },
        },
      });
      if (!task) return false;
      if (task.visibility === TaskVisibility.PRIVATE) {
        const allowed =
          canAdminister(membership.role) ||
          task.ownerId === userId ||
          task.assignedById === userId ||
          task.assignees.length > 0 ||
          task.shares.length > 0;
        if (!allowed) return false;
      }
    }
    return true;
  }

  private async assertAttachTargets(
    membership: WorkspaceMembershipContext,
    userId: string,
    attach: FileAttach,
  ) {
    const workspaceId = membership.workspaceId;
    if (attach.taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: attach.taskId, workspaceId },
        select: { id: true },
      });
      if (!task) throw new BadRequestException('Task not found in this workspace');
    }
    if (attach.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: attach.projectId, workspaceId },
        select: { id: true },
      });
      if (!project) {
        throw new BadRequestException('Project not found in this workspace');
      }
    }
    if (attach.meetingId) {
      const meeting = await this.prisma.meeting.findFirst({
        where: { id: attach.meetingId, workspaceId },
        select: { id: true },
      });
      if (!meeting) {
        throw new BadRequestException('Meeting not found in this workspace');
      }
    }
    if (attach.teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: attach.teamId, workspaceId },
        select: { id: true },
      });
      if (!team) throw new BadRequestException('Team not found in this workspace');
    }
    if (attach.pageId) {
      const page = await this.prisma.workspacePage.findFirst({
        where: { id: attach.pageId, workspaceId },
        select: { id: true },
      });
      if (!page) throw new BadRequestException('Page not found in this workspace');
    }
    if (attach.conversationId) {
      const conversation = await this.prisma.chatConversation.findFirst({
        where: { id: attach.conversationId, workspaceId },
        select: {
          privacy: true,
          kind: true,
          members: { where: { userId }, select: { id: true } },
        },
      });
      if (!conversation) {
        throw new BadRequestException('Conversation not found in this workspace');
      }
      const allowed =
        (conversation.privacy === ChatPrivacy.PUBLIC &&
          conversation.kind === ChatKind.CHANNEL) ||
        conversation.members.length > 0 ||
        canAdminister(membership.role);
      if (!allowed) {
        throw new ForbiddenException('You cannot attach files to this conversation');
      }
    }
    if (attach.commentId) {
      const comment = await this.prisma.taskComment.findFirst({
        where: { id: attach.commentId, workspaceId },
        select: { id: true },
      });
      if (!comment) {
        throw new BadRequestException('Comment not found in this workspace');
      }
    }
    if (attach.messageId) {
      const message = await this.prisma.chatMessage.findFirst({
        where: { id: attach.messageId, workspaceId },
        select: { id: true },
      });
      if (!message) {
        throw new BadRequestException('Message not found in this workspace');
      }
    }
  }
}
