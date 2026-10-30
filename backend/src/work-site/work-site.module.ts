import { Module } from '@nestjs/common';
import { WorkSiteService } from './work-site.service';
import { WorkSiteController } from './work-site.controller';

@Module({
  controllers: [WorkSiteController],
  providers: [WorkSiteService],
  exports: [WorkSiteService],
})
export class WorkSiteModule {}
