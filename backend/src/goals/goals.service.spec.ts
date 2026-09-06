import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectStatus, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { GoalsService } from './goals.service';

const member: WorkspaceMembershipContext = {
  workspaceId: 'ws-1',
  memberId: 'mem-1',
  role: WorkspaceRole.MEMBER,
};

describe('GoalsService', () => {
  let service: GoalsService;
  const prisma = {
    goal: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  };
  const projectsService = { assertProjectInWorkspace: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectsService, useValue: projectsService },
      ],
    }).compile();
    service = module.get(GoalsService);
  });

  it('lists goals only for the membership workspace', async () => {
    prisma.goal.findMany.mockResolvedValue([]);
    await service.list(member);
    expect(prisma.goal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'ws-1' },
      }),
    );
  });

  it('does not return a goal from another workspace', async () => {
    prisma.goal.findFirst.mockResolvedValue(null);
    await expect(service.findById(member, 'goal-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects linking a project from another workspace', async () => {
    projectsService.assertProjectInWorkspace.mockRejectedValue(
      new BadRequestException('Project not found in this workspace'),
    );
    await expect(
      service.create(member, 'user-1', {
        title: 'Ship v1',
        projectIds: ['proj-other'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sets progress from milestone averages', async () => {
    projectsService.assertProjectInWorkspace.mockResolvedValue({
      id: 'proj-1',
      status: ProjectStatus.ACTIVE,
    });
    prisma.goal.create.mockResolvedValue({
      id: 'goal-1',
      progress: 50,
      projects: [],
      milestones: [],
    });
    await service.create(member, 'user-1', {
      title: 'Ship v1',
      milestones: [
        { title: 'Design', progress: 25 },
        { title: 'Build', progress: 75 },
      ],
    });
    expect(prisma.goal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ progress: 50 }),
      }),
    );
  });
});
