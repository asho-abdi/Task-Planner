import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TodoStatus, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { TodosService } from './todos.service';

const member: WorkspaceMembershipContext = {
  workspaceId: 'ws-1',
  memberId: 'mem-1',
  role: WorkspaceRole.MEMBER,
};

describe('TodosService', () => {
  let service: TodosService;
  const prisma = {
    todo: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TodosService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(TodosService);
  });

  it("lists only the current user's todos in the workspace", async () => {
    prisma.todo.findMany.mockResolvedValue([]);
    await service.list(member, 'user-1', {});
    expect(prisma.todo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'ws-1',
          userId: 'user-1',
          status: { not: TodoStatus.ARCHIVED },
        }),
      }),
    );
  });

  it("does not return another user's todo", async () => {
    prisma.todo.findFirst.mockResolvedValue(null);
    await expect(
      service.findById(member, 'user-1', 'todo-x'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.todo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'todo-x', workspaceId: 'ws-1', userId: 'user-1' },
      }),
    );
  });

  it('marks a todo completed', async () => {
    prisma.todo.findFirst.mockResolvedValue({
      id: 'todo-1',
      status: TodoStatus.PENDING,
      completedAt: null,
    });
    prisma.todo.update.mockResolvedValue({
      id: 'todo-1',
      status: TodoStatus.COMPLETED,
    });
    await service.complete(member, 'user-1', 'todo-1');
    expect(prisma.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: TodoStatus.COMPLETED }),
      }),
    );
  });

  it('archives a personal todo', async () => {
    prisma.todo.findFirst.mockResolvedValue({
      id: 'todo-1',
      status: TodoStatus.PENDING,
    });
    prisma.todo.update.mockResolvedValue({
      id: 'todo-1',
      status: TodoStatus.ARCHIVED,
    });
    await service.archive(member, 'user-1', 'todo-1');
    expect(prisma.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: TodoStatus.ARCHIVED },
      }),
    );
  });
});
