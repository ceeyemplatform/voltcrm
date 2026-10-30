import { Controller, Get, Query } from '@nestjs/common';
import { PolevarService } from './polevar.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('polevar')
export class PolevarController {
  constructor(private readonly polevarService: PolevarService) {}

  @Get('sheets')
  getSheets(
    @CurrentUser('id') userId: string,
    @Query('workSiteId') workSiteId?: string,
    @Query('section') section?: string,
    @Query('search') search?: string,
  ) {
    return this.polevarService.getSheets(userId, { workSiteId, section, search });
  }

  @Get('report')
  getReport(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('workCode') workCode?: string,
    @Query('workSiteId') workSiteId?: string,
    @Query('search') search?: string,
  ) {
    return this.polevarService.getReport(userId, {
      startDate,
      endDate,
      workCode,
      workSiteId,
      search,
    });
  }
}
