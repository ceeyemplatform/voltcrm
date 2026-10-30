import {
  Controller,
  Get,
  Put,
  Post,
  Body,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { CloudSyncService } from './cloud-sync.service';

@Controller('cloud-sync')
export class CloudSyncController {
  constructor(private readonly syncService: CloudSyncService) {}

  @Get('settings')
  getSettings(@CurrentUser('id') userId: string) {
    return this.syncService.getSettings(userId);
  }

  @Put('settings')
  updateSettings(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      googleSheetWebhookUrl?: string;
      googleSheetUrl?: string;
      autoSync?: boolean;
    },
  ) {
    return this.syncService.updateSettings(userId, body);
  }

  // Each push sends all data to Google: at most 5 per minute
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('push')
  pushToGoogleSheet(
    @CurrentUser('id') userId: string,
    @Body() body?: { webhookUrl?: string },
  ) {
    return this.syncService.pushToGoogleSheet(userId, body?.webhookUrl);
  }

  @Get('template')
  getTemplate() {
    return {
      template: this.syncService.getGoogleAppsScriptTemplate(),
    };
  }
}

