import { Module } from '@nestjs/common';
import { PolevarService } from './polevar.service';
import { PolevarController } from './polevar.controller';

@Module({
  controllers: [PolevarController],
  providers: [PolevarService],
  exports: [PolevarService],
})
export class PolevarModule {}
