import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { WorkService } from './work.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('works')
export class WorkController {
  constructor(private readonly workService: WorkService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateWorkDto) {
    return this.workService.create(userId, dto);
  }

  @Get('options')
  getOptions(@CurrentUser('id') userId: string) {
    return this.workService.getOptions(userId);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('workSiteId') workSiteId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.workService.findAll(userId, {
      search,
      status,
      workSiteId,
      startDate,
      endDate,
    });
  }

  @Get(':id/polevar')
  getPolevar(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.workService.getPolevar(userId, id);
  }

  @Put(':id/polevar')
  updatePolevar(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.workService.updatePolevar(userId, id, data);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.workService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkDto,
  ) {
    return this.workService.update(userId, id, dto);
  }

  @Put(':id/daily-details')
  updateDailyDetails(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: { dailyDetails: any },
  ) {
    return this.workService.updateDailyDetails(userId, id, body.dailyDetails);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.workService.remove(userId, id);
  }
}
