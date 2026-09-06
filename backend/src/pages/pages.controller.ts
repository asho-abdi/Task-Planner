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
import { CreatePageDto, UpdatePageDto } from './dto/page.dto';
import { PagesService } from './pages.service';

@Controller('pages')
@WorkspaceScoped()
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  list(@CurrentMembership() membership: WorkspaceMembershipContext) {
    return this.pagesService.list(membership);
  }

  @Post()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  create(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePageDto,
  ) {
    return this.pagesService.create(membership, user.id, dto);
  }

  @Get(':pageId')
  getOne(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('pageId') pageId: string,
  ) {
    return this.pagesService.findById(membership, pageId);
  }

  @Patch(':pageId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  update(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('pageId') pageId: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.pagesService.update(membership, pageId, dto);
  }

  @Delete(':pageId')
  @HttpCode(204)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  remove(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Param('pageId') pageId: string,
  ) {
    return this.pagesService.remove(membership, pageId);
  }
}
