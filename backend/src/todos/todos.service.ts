import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TodoStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { assertCanMutate } from '../common/permissions';
import {
  CreateTodoDto,
  ListTodosQueryDto,
  UpdateTodoDto,
} from './dto/todo.dto';

const todoSelect = {
  id: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  dueDate: true,
  reminderAt: true,
  completedAt: true,
  workspaceId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TodoSelect;

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    membership: WorkspaceMembershipContext,
    userId: string,
    query: ListTodosQueryDto,
  ) {
    const where: Prisma.TodoWhereInput = {
      workspaceId: membership.workspaceId,
      userId,
    };
    if (query.status) {
      where.status = query.status;
    } else if (!query.includeArchived) {
      where.status = { not: TodoStatus.ARCHIVED };
    }
    return this.prisma.todo.findMany({
      where,
      select: todoSelect,
      orderBy: [
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { updatedAt: 'desc' },
      ],
    });
  }

  async findById(
    membership: WorkspaceMembershipContext,
    userId: string,
    todoId: string,
  ) {
    return this.requireTodo(membership.workspaceId, userId, todoId);
  }

  async create(
    membership: WorkspaceMembershipContext,
    userId: string,
    dto: CreateTodoDto,
  ) {
    assertCanMutate(membership);
    return this.prisma.todo.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : null,
        workspaceId: membership.workspaceId,
        userId,
      },
      select: todoSelect,
    });
  }

  async update(
    membership: WorkspaceMembershipContext,
    userId: string,
    todoId: string,
    dto: UpdateTodoDto,
  ) {
    assertCanMutate(membership);
    await this.requireTodo(membership.workspaceId, userId, todoId);
    return this.prisma.todo.update({
      where: { id: todoId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
        ...(dto.reminderAt !== undefined
          ? { reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : null }
          : {}),
      },
      select: todoSelect,
    });
  }

  async complete(
    membership: WorkspaceMembershipContext,
    userId: string,
    todoId: string,
  ) {
    assertCanMutate(membership);
    const todo = await this.requireTodo(membership.workspaceId, userId, todoId);
    if (todo.status === TodoStatus.ARCHIVED) {
      return todo;
    }
    return this.prisma.todo.update({
      where: { id: todoId },
      data: {
        status: TodoStatus.COMPLETED,
        completedAt: todo.completedAt ?? new Date(),
      },
      select: todoSelect,
    });
  }

  async archive(
    membership: WorkspaceMembershipContext,
    userId: string,
    todoId: string,
  ) {
    assertCanMutate(membership);
    await this.requireTodo(membership.workspaceId, userId, todoId);
    return this.prisma.todo.update({
      where: { id: todoId },
      data: { status: TodoStatus.ARCHIVED },
      select: todoSelect,
    });
  }

  private async requireTodo(
    workspaceId: string,
    userId: string,
    todoId: string,
  ) {
    const todo = await this.prisma.todo.findFirst({
      where: { id: todoId, workspaceId, userId },
      select: todoSelect,
    });
    if (!todo) {
      throw new NotFoundException('Todo not found');
    }
    return todo;
  }
}
