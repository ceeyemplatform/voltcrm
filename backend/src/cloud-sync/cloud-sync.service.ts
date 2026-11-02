import { assignMissingCodes } from '../common/codes';
import { ExpenseService } from '../expense/expense.service';
import { APPS_SCRIPT_TEMPLATE } from './apps-script';
import { buildSheetPayload, SHEET_PAYLOAD_VERSION } from './sheet-builder';
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
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

@Injectable()
export class CloudSyncService {
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
    const webhook = dto.googleSheetWebhookUrl?.trim() ? assertGoogleUrl(dto.googleSheetWebhookUrl.trim(), 'webhook') : null;
    const sheet = dto.googleSheetUrl?.trim() ? assertGoogleUrl(dto.googleSheetUrl.trim(), 'sheet') : null;
    return this.prisma.cloudSyncSettings.upsert({
      where: { userId },
      create: {
        userId,
        googleSheetWebhookUrl: webhook,
        googleSheetUrl: sheet,
        autoSync: Boolean(dto.autoSync),
      },
      update: {
        googleSheetWebhookUrl: webhook,
        googleSheetUrl: sheet,
        autoSync: dto.autoSync !== undefined ? Boolean(dto.autoSync) : undefined,
      },
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

