import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    return {
      status: 'ok',
      service: 'tabley-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Deep health probe — checks every data service the API depends on. Returns
   * 200 with a per-service breakdown so you can `curl /health/full | jq` and
   * see exactly what's broken when "Failed to fetch" pops on the web.
   */
  @Get('full')
  async full() {
    const [pg, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()]);
    return {
      service: 'tabley-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: { postgres: pg, redis },
    };
  }

  private async checkPostgres(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  private async checkRedis(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const client = new Redis(url, {
      // Fail fast — we don't want the health probe to hang for 30s if redis is down.
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
      lazyConnect: true,
    });
    try {
      await client.connect();
      await client.ping();
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    } finally {
      client.disconnect();
    }
  }
}
