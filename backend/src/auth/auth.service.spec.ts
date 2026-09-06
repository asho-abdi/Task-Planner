import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    toPublicUser: jest.fn((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })),
  };
  const workspacesService = {
    create: jest.fn(),
    acceptInvitation: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn(),
  };
  const prisma = {
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const response = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    jest.clearAllMocks();
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('secret') },
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('rejects invalid login credentials', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: 'a@b.com', password: 'secret12' }, response),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not create a workspace when registering without an invite', async () => {
    const user = {
      id: 'user-1',
      email: 'a@b.com',
      name: 'Ada',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    usersService.create.mockResolvedValue(user);

    const result = await service.register(
      { email: 'a@b.com', password: 'secret12', name: 'Ada' },
      response,
    );

    expect(workspacesService.create).not.toHaveBeenCalled();
    expect(workspacesService.acceptInvitation).not.toHaveBeenCalled();
    expect(result.accessToken).toBe('access-token');
    expect(response.cookie).toHaveBeenCalled();
  });

  it('joins the invited workspace when registering with an invite token', async () => {
    const user = {
      id: 'user-1',
      email: 'a@b.com',
      name: 'Ada',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    usersService.create.mockResolvedValue(user);
    workspacesService.acceptInvitation.mockResolvedValue({
      workspaceId: 'ws-1',
    });

    await service.register(
      {
        email: 'a@b.com',
        password: 'secret12',
        name: 'Ada',
        inviteToken: 'a'.repeat(32),
      },
      response,
    );

    expect(workspacesService.acceptInvitation).toHaveBeenCalledWith(
      'user-1',
      'a@b.com',
      'a'.repeat(32),
    );
    expect(workspacesService.create).not.toHaveBeenCalled();
  });

  it('rotates a valid refresh token', async () => {
    const user = {
      id: 'user-1',
      email: 'a@b.com',
      name: 'Ada',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.refreshToken.findFirst.mockResolvedValue({ id: 'rt-1' });
    prisma.refreshToken.update.mockResolvedValue({ id: 'rt-1' });
    jwtService.signAsync.mockReset();
    jwtService.signAsync.mockResolvedValue('rotated-token');

    const result = await service.refresh(
      user as never,
      'refresh-token',
      response,
    );

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { revoked: true },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
    expect(result.accessToken).toBe('rotated-token');
  });

  it('revokes every session when a rotated refresh token is reused', async () => {
    const user = {
      id: 'user-1',
      email: 'a@b.com',
      name: 'Ada',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.refreshToken.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'rt-old' });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      service.refresh(user as never, 'stolen-token', response),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { revoked: true },
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('revokes the presented refresh token on logout', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    await service.logout(response, 'refresh-token');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String) },
      data: { revoked: true },
    });
    expect(response.clearCookie).toHaveBeenCalled();
  });

  it('surfaces email conflicts from user creation', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    usersService.create.mockRejectedValue(
      new ConflictException('A user with this email already exists'),
    );

    await expect(
      service.register(
        { email: 'a@b.com', password: 'secret12', name: 'Ada' },
        response,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
