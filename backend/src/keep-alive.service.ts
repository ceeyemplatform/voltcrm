import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

const INTERVAL_MS = 10 * 60 * 1000;

/**
 * Every 10 minutes: logs how many people signed up, and pings the app's own public
 * address. On free hosting this keeps the server (Render sleeps after 15 idle minutes)
 * and the database (Supabase pauses after a week without queries) awake.
 */
@Injectable()
export class KeepAliveService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('KeepAlive');
  private timer?: NodeJS.Timeout;
  private first?: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {}

  onApplicationBootstrap() {
    // First run a minute after start-up, so the log shows it working, then every 10 minutes
    this.first = setTimeout(() => void this.tick(), 60_000);
    this.first.unref();
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  /** Public address of this server: set by Render, or KEEP_ALIVE_URL elsewhere */
  private get selfUrl() {
    return (process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
  }

  async tick() {
    try {
      const [row] = await this.prisma.$queryRaw<{ total: number; last10: number; last24h: number }[]>`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE created_at > now() - interval '10 minutes')::int AS last10,
               count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS last24h
        FROM auth.users`;
      this.logger.log(
        `Signups · last 10 min: ${row.last10} · last 24 h: ${row.last24h} · total users: ${row.total}`,
      );
    } catch (err: any) {
      this.logger.warn(`Signup count failed: ${err?.message || err}`);
    }

    // Going through the public address counts as outside traffic, so the host doesn't sleep
    if (this.selfUrl) {
      try {
        const res = await fetch(`${this.selfUrl}/api/health`, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) this.logger.warn(`Self-ping returned ${res.status}`);
      } catch (err: any) {
        this.logger.warn(`Self-ping failed: ${err?.message || err}`);
      }
    }
  }
}
