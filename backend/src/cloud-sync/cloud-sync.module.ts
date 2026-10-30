import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudSyncController } from './cloud-sync.controller';
import { CloudSyncService } from './cloud-sync.service';

@Module({
  imports: [PrismaModule],
  controllers: [CloudSyncController],
  providers: [CloudSyncService],
  exports: [CloudSyncService],
})
export class CloudSyncModule {}

