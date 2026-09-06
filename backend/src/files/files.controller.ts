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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { tmpdir } from 'os';
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
import { FilesService } from './files.service';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

class FileQueryDto {
  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  meetingId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  pageId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  commentId?: string;

  @IsOptional()
  @IsString()
  messageId?: string;
}

class AttachFileDto extends FileQueryDto {}

class RenameFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  originalName!: string;
}

@Controller('files')
@WorkspaceScoped()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  list(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Query() query: FileQueryDto,
  ) {
    return this.filesService.list(membership, user.id, query);
  }

  @Post()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_req, file, cb) =>
          cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.\-]+/g, '_')}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AttachFileDto,
  ) {
    return this.filesService.upload(membership, user.id, file, dto);
  }

  @Get(':fileId/preview')
  async preview(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { file, originalName, mimeType } = await this.filesService.download(
      membership,
      user.id,
      fileId,
    );
    response.setHeader('Content-Type', mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${originalName.replace(/"/g, '')}"`,
    );
    return file;
  }

  @Get(':fileId/download')
  async download(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { file, originalName, mimeType } = await this.filesService.download(
      membership,
      user.id,
      fileId,
    );
    response.setHeader('Content-Type', mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${originalName.replace(/"/g, '')}"`,
    );
    return file;
  }

  @Patch(':fileId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  rename(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('fileId') fileId: string,
    @Body() dto: RenameFileDto,
  ) {
    return this.filesService.rename(membership, user.id, fileId, dto.originalName);
  }

  @Post(':fileId/move')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  move(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('fileId') fileId: string,
    @Body() dto: AttachFileDto,
  ) {
    return this.filesService.move(membership, user.id, fileId, dto);
  }

  @Delete(':fileId')
  @HttpCode(204)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  remove(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('fileId') fileId: string,
  ) {
    return this.filesService.remove(membership, user.id, fileId);
  }
}
