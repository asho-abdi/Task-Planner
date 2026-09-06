import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis | null;

  constructor(configService: ConfigService) {
    const host = configService.get<string>('redis.host');
    const port = configService.get<number>('redis.port') ?? 6379;

    this.client = host
      ? new Redis({
          host,
          port,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 1500,
          retryStrategy: () => null,
        })
      : null;

    this.client?.on('error', () => undefined);
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async ping(): Promise<boolean> {
    const client = await this.ensureConnected();
    if (!client) {
      return false;
    }

    const result = await client.ping();
    return result === 'PONG';
  }

  async get(key: string): Promise<string | null> {
    const client = await this.ensureConnected();
    if (!client) {
      return null;
    }
    try {
      return await client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const client = await this.ensureConnected();
    if (!client) {
      return;
    }
    try {
      await client.set(key, value, 'EX', ttlSeconds);
    } catch {
      return;
    }
  }

  private async ensureConnected(): Promise<Redis | null> {
    if (!this.client) {
      return null;
    }
    try {
      if (this.client.status === 'wait' || this.client.status === 'end') {
        await this.client.connect();
      }
      return this.client;
    } catch {
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }
}
