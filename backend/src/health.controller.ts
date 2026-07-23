import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Controller()
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  @Get('health/live')
  live() {
    return { status: 'ok', service: 'maskara-api' };
  }

  /** Public site footer / contact block (editable from Super Admin → Settings). */
  @Get('public/contact')
  async publicContact() {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'contact' },
    });
    const value =
      row?.value && typeof row.value === 'object' && !Array.isArray(row.value)
        ? (row.value as Record<string, unknown>)
        : {};
    return {
      email: String(value.email || 'support@maskara.bd'),
      phone: String(value.phone || '+880 1XXX-XXXXXX'),
      location: String(value.location || 'Dhaka, Bangladesh'),
    };
  }

  @Get('health')
  async health() {
    const checks: Record<string, string> = { api: 'ok' };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    try {
      const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';
      const redis = new Redis(redisUrl, { connectTimeout: 3000, maxRetriesPerRequest: 1 });
      await redis.ping();
      redis.disconnect();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }

    const healthy = Object.values(checks).every((v) => v === 'ok');
    const body = {
      status: healthy ? 'ok' : 'degraded',
      service: 'maskara-api',
      checks,
      env: process.env.NODE_ENV || 'development',
    };

    if (!healthy) {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }
}
