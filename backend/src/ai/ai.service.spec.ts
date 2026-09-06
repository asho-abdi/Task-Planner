import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { AiClient } from './ai.client';
import { AiService } from './ai.service';

const member: WorkspaceMembershipContext = {
  workspaceId: 'ws-1',
  memberId: 'mem-1',
  role: WorkspaceRole.MEMBER,
};

describe('AiService', () => {
  let service: AiService;
  const client = {
    isConfigured: jest.fn(),
    completeJson: jest.fn(),
  };
  const prisma = {
    project: { findFirst: jest.fn() },
    task: { findFirst: jest.fn() },
    meeting: { findFirst: jest.fn() },
  };
  const reports = {
    getReports: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    client.isConfigured.mockReturnValue(false);
    client.completeJson.mockResolvedValue({ ok: false, reason: 'missing_key' });
    prisma.project.findFirst.mockResolvedValue(null);
    prisma.task.findFirst.mockResolvedValue(null);
    prisma.meeting.findFirst.mockResolvedValue(null);
    reports.getReports.mockResolvedValue({
      from: '2026-08-16',
      to: '2026-08-29',
      completion: { completionRate: 0.5, completed: 4, open: 4 },
      overdue: { count: 2 },
      workload: { overloadedCount: 1 },
      projectPerformance: { items: [{ name: 'Alpha' }] },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AiClient, useValue: client },
        { provide: PrismaService, useValue: prisma },
        { provide: ReportsService, useValue: reports },
      ],
    }).compile();
    service = module.get(AiService);
  });

  it('reports heuristic status when no key is configured', () => {
    expect(service.status()).toEqual({ enabled: false, source: 'heuristic' });
  });

  it('returns a clearly labeled template plan when AI is unavailable', async () => {
    const result = await service.plan(member, {
      prompt: '- Draft kickoff\n- Book room',
    });
    expect(result.source).toBe('heuristic');
    expect(result.unavailableReason).toBe('missing_key');
    expect(result.summary).toMatch(/Template plan/i);
    expect(result.tasks.map((task) => task.title)).toEqual([
      'Draft kickoff',
      'Book room',
    ]);
    expect(JSON.stringify(result)).not.toContain('sk-');
  });

  it('returns provider JSON as AI when the payload is valid', async () => {
    client.completeJson.mockResolvedValue({
      ok: true,
      data: {
        title: 'Launch plan',
        summary: 'Ship the beta.',
        tasks: [{ title: 'Write spec', description: '', priority: 'HIGH' }],
      },
    });

    const result = await service.plan(member, { prompt: 'launch beta' });
    expect(result).toMatchObject({
      source: 'ai',
      title: 'Launch plan',
      tasks: [
        expect.objectContaining({ title: 'Write spec', priority: 'HIGH' }),
      ],
    });
    expect(result.unavailableReason).toBeUndefined();
  });

  it('falls back after invalid AI JSON, timeouts, and rate limits', async () => {
    client.completeJson.mockResolvedValue({
      ok: true,
      data: { title: '', summary: '', tasks: [] },
    });
    await expect(
      service.plan(member, { prompt: 'Ship it' }),
    ).resolves.toMatchObject({
      source: 'heuristic',
      unavailableReason: 'invalid_response',
    });

    client.completeJson.mockResolvedValue({ ok: false, reason: 'timeout' });
    await expect(
      service.assist(member, { question: 'What next?' }),
    ).resolves.toMatchObject({
      source: 'heuristic',
      unavailableReason: 'timeout',
      answer: expect.stringMatching(/not an AI-generated answer/i),
    });

    client.completeJson.mockResolvedValue({ ok: false, reason: 'rate_limit' });
    await expect(
      service.extract(member, { text: '- Call the client\n- Send recap' }),
    ).resolves.toMatchObject({
      source: 'heuristic',
      unavailableReason: 'rate_limit',
    });
  });

  it('scopes meeting extraction to the workspace', async () => {
    prisma.meeting.findFirst.mockResolvedValue(null);
    await expect(
      service.extract(member, { meetingId: 'mtg-x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.meeting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mtg-x', workspaceId: 'ws-1' },
      }),
    );
  });

  it('rejects extraction without source text', async () => {
    await expect(service.extract(member, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('builds a template report narrative from existing report data', async () => {
    const result = await service.reportNarrative(member, {});
    expect(reports.getReports).toHaveBeenCalledWith(
      member,
      expect.objectContaining({ page: 1, pageSize: 5 }),
    );
    expect(result.source).toBe('heuristic');
    expect(result.headline).toContain('50%');
    expect(result.narrative).toMatch(/not an AI narrative/i);
    expect(result.highlights[2]).toContain('Alpha');
  });
});
