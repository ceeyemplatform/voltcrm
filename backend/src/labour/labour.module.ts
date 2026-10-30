import { Module } from '@nestjs/common';
import { LabourService } from './labour.service';
import { LabourController } from './labour.controller';

@Module({
  controllers: [LabourController],
  providers: [LabourService],
  exports: [LabourService],
})
export class LabourModule {}
