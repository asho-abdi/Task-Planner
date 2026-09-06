import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertCanMutate } from '../common/permissions';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { CreatePageDto, UpdatePageDto } from './dto/page.dto';

const pageSelect = {
  id: true,
  title: true,
  body: true,
  workspaceId: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  list(membership: WorkspaceMembershipContext) {
    return this.prisma.workspacePage.findMany({
      where: { workspaceId: membership.workspaceId },
      select: pageSelect,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(membership: WorkspaceMembershipContext, pageId: string) {
    const page = await this.prisma.workspacePage.findFirst({
      where: { id: pageId, workspaceId: membership.workspaceId },
      select: pageSelect,
    });
    if (!page) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  create(
    membership: WorkspaceMembershipContext,
    userId: string,
    dto: CreatePageDto,
  ) {
    assertCanMutate(membership);
    return this.prisma.workspacePage.create({
      data: {
        workspaceId: membership.workspaceId,
        authorId: userId,
        title: dto.title.trim(),
        body: dto.body?.trim() ?? '',
      },
      select: pageSelect,
    });
  }

  async update(
    membership: WorkspaceMembershipContext,
    pageId: string,
    dto: UpdatePageDto,
  ) {
    assertCanMutate(membership);
    const page = await this.findById(membership, pageId);
    return this.prisma.workspacePage.update({
      where: { id: page.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
      },
      select: pageSelect,
    });
  }

  async remove(membership: WorkspaceMembershipContext, pageId: string) {
    assertCanMutate(membership);
    const page = await this.findById(membership, pageId);
    await this.prisma.workspacePage.delete({ where: { id: page.id } });
  }
}
