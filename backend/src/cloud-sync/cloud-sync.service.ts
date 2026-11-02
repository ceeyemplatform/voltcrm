import { assignMissingCodes } from '../common/codes';
import { ExpenseService } from '../expense/expense.service';
import { APPS_SCRIPT_TEMPLATE } from './apps-script';
import { buildSheetPayload, SHEET_PAYLOAD_VERSION } from './sheet-builder';
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sync only ever talks to Google: the webhook must be an Apps Script web app and the sheet link a
 * Google Sheets page. Anything else (internal addresses, other hosts, non-https) is refused, so
 * the server can't be used to call arbitrary URLs.
 */
const assertGoogleUrl = (value: string, kind: 'webhook' | 'sheet') => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException(`Invalid ${kind === 'webhook' ? 'Apps Script webhook' : 'Google Sheet'} URL`);
  }
  const allowedHosts = kind === 'webhook' ? ['script.google.com'] : ['docs.google.com'];
  if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname) || url.username || url.password || url.port) {
    throw new BadRequestException(
      kind === 'webhook'
        ? 'The webhook must be a Google Apps Script web app URL (https://script.google.com/...)'
        : 'The sheet link must be a Google Sheets URL (https://docs.google.com/...)',
    );
  }
  return url.toString();
};

/** Daily sync time in India (IST, UTC+5:30, no daylight saving) */
const DAILY_SYNC_HOUR_IST = 23;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 5 * 60 * 1000;
/** Failed daily syncs are retried at most this many times per night */
const MAX_DAILY_ATTEMPTS = 3;

/** Today's 11 PM in India as a moment in time, and whether it has passed */
const dailySyncMoment = (now = new Date()) => {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const due = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), DAILY_SYNC_HOUR_IST) - IST_OFFSET_MS,
  );
  return { due, isPast: now >= due, day: ist.toISOString().slice(0, 10) };
};

@Injectable()
export class CloudSyncService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('DailySync');
  private timer?: NodeJS.Timeout;
  private running = false;
  /** Attempts per user for the current night, e.g. "2026-11-02:userId" -> 1 */
  private attempts = new Map<string, number>();

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.runDailySync(), CHECK_EVERY_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * After 11 PM India time, syncs every account that has daily sync on and hasn't synced since.
   * Checked every 5 minutes, so a restart or a short outage still syncs that night.
   */
  async runDailySync() {
    const { due, isPast, day } = dailySyncMoment();
    if (!isPast || this.running) return;
    this.running = true;
    try {
      const pending = await this.prisma.cloudSyncSettings.findMany({
        where: {
          autoSync: true,
          googleSheetWebhookUrl: { not: null },
          OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: due } }],
        },
        select: { userId: true },
      });
      for (const { userId } of pending) {
        const key = `${day}:${userId}`;
        const tries = this.attempts.get(key) || 0;
        if (tries >= MAX_DAILY_ATTEMPTS) continue;
        this.attempts.set(key, tries + 1);
        try {
          await this.pushToGoogleSheet(userId);
          this.logger.log(`Daily sync done for ${userId}`);
        } catch (err: any) {
          this.logger.warn(`Daily sync failed for ${userId} (try ${tries + 1}): ${err?.message || err}`);
        }
      }
      // Forget earlier nights
      for (const k of this.attempts.keys()) if (!k.startsWith(`${day}:`)) this.attempts.delete(k);
    } finally {
      this.running = false;
    }
  }

  constructor(
    private prisma: PrismaService,
    private expenseService: ExpenseService,
  ) {}

  async getSettings(userId: string) {
    let settings = await this.prisma.cloudSyncSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.cloudSyncSettings.create({
        data: {
          userId,
          autoSync: false,
        },
      });
    }

    return settings;
  }

  async updateSettings(
    userId: string,
    dto: {
      googleSheetWebhookUrl?: string;
      googleSheetUrl?: string;
      autoSync?: boolean;
    },
  ) {
    // Only the fields sent are changed, so turning daily sync on/off keeps the saved links
    const data: { googleSheetWebhookUrl?: string | null; googleSheetUrl?: string | null; autoSync?: boolean } = {};
    if (dto.googleSheetWebhookUrl !== undefined) {
      const v = dto.googleSheetWebhookUrl.trim();
      data.googleSheetWebhookUrl = v ? assertGoogleUrl(v, 'webhook') : null;
    }
    if (dto.googleSheetUrl !== undefined) {
      const v = dto.googleSheetUrl.trim();
      data.googleSheetUrl = v ? assertGoogleUrl(v, 'sheet') : null;
    }
    if (dto.autoSync !== undefined) data.autoSync = Boolean(dto.autoSync);
    return this.prisma.cloudSyncSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async pushToGoogleSheet(userId: string, webhookUrlOverride?: string) {
    const settings = await this.getSettings(userId);
    const rawWebhookUrl = webhookUrlOverride?.trim() || settings.googleSheetWebhookUrl;

    if (!rawWebhookUrl) {
      throw new BadRequestException(
        'Google Sheets Webhook URL is not configured. Please paste your Google Apps Script Webhook URL.',
      );
    }

    const targetWebhookUrl = assertGoogleUrl(rawWebhookUrl, 'webhook');

    // 1. Everything this user has saved; older sites and workers get their codes first
    await assignMissingCodes(this.prisma, userId);
    const [works, sites, labours, quotations, expenses, summary] = await Promise.all([
      this.prisma.work.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      this.prisma.workSite.findMany({ where: { userId }, orderBy: { siteCode: 'asc' } }),
      this.prisma.labour.findMany({ where: { userId }, orderBy: { labourCode: 'asc' } }),
      this.prisma.quotation.findMany({
        where: { userId },
        include: { workSite: true, items: { orderBy: { createdAt: 'asc' } } },
        orderBy: { date: 'desc' },
      }),
      this.prisma.expense.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      this.expenseService.getSummary(userId),
    ]);

    // 2. One tab per kind of record, linked by codes
    const { payload, counts } = buildSheetPayload({
      works,
      sites,
      labours,
      quotations,
      expenses,
      ledger: summary.items,
    });

    try {
      const response = await fetch(targetWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });

      // Apps Script redirects to script.googleusercontent.com; refuse redirects anywhere else
      const finalHost = new URL(response.url || targetWebhookUrl).hostname;
      if (!['script.google.com', 'script.googleusercontent.com'].includes(finalHost)) {
        throw new Error('Google Sheets webhook redirected to an unexpected address');
      }
      if (!response.ok && response.status !== 302) {
        // The remote reply is not passed back to the browser
        throw new Error(`Google Sheets responded with status ${response.status}`);
      }

      // The script reports its version; an older script can't read this data and would do nothing
      let result: { status?: string; version?: number } = {};
      try {
        result = JSON.parse(await response.text());
      } catch {
        // Not JSON: treated as an old or unknown script below
      }
      if (result.status === 'error') {
        throw new Error('the sheet script reported an error. Open Apps Script → Executions to see why');
      }
      if (!result.version || result.version < SHEET_PAYLOAD_VERSION) {
        throw new BadRequestException(
          'Your Google Sheet still has the old VoltCRM script. Copy the new script from Cloud Sync, paste it in ' +
            'Extensions → Apps Script, then Deploy → Manage deployments → Edit → New version → Deploy.',
        );
      }

      // Record successful sync timestamp
      const updatedSettings = await this.prisma.cloudSyncSettings.update({
        where: { userId },
        data: {
          lastSyncedAt: new Date(),
        },
      });

      return {
        success: true,
        lastSyncedAt: updatedSettings.lastSyncedAt,
        summary: counts,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException(
        `Failed to sync with Google Sheet: ${err.message}`,
      );
    }
  }

  getGoogleAppsScriptTemplate() {
    return APPS_SCRIPT_TEMPLATE;
  }
}

