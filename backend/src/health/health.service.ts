import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type HealthStatus = 'ok' | 'error';
export type ComponentStatus = 'up' | 'down' | 'disabled';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async check() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const status: HealthStatus = database === 'up' ? 'ok' : 'error';
    const aiConfigured = Boolean(this.config.get<string>('ai.apiKey'));

    return {
      status,
      info: {
        database: { status: database },
        redis: { status: redis },
        ai: { status: aiConfigured ? 'configured' : 'disabled' },
      },
    };
  }

  private async checkDatabase(): Promise<ComponentStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<ComponentStatus> {
    if (!this.redis.isConfigured()) {
      return 'disabled';
    }

    try {
      const ok = await this.redis.ping();
      return ok ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
