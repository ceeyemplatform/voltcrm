import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { LabourModule } from './labour/labour.module';
import { WorkSiteModule } from './work-site/work-site.module';
import { WorkModule } from './work/work.module';
import { QuotationModule } from './quotation/quotation.module';
import { ExpenseModule } from './expense/expense.module';
import { PolevarModule } from './polevar/polevar.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CloudSyncModule } from './cloud-sync/cloud-sync.module';
import { CompanySettingsModule } from './company-settings/company-settings.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Limits repeated requests per client: 300 per minute in general (stricter on cloud sync)
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    LabourModule,
    WorkSiteModule,
    WorkModule,
    QuotationModule,
    ExpenseModule,
    PolevarModule,
    DashboardModule,
    CloudSyncModule,
    CompanySettingsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
