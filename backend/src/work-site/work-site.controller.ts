import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { WorkSiteService } from './work-site.service';
import { CreateWorkSiteDto } from './dto/create-work-site.dto';
import { UpdateWorkSiteDto } from './dto/update-work-site.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('work-sites')
export class WorkSiteController {
  constructor(private readonly workSiteService: WorkSiteService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateWorkSiteDto) {
    return this.workSiteService.create(userId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('search') search?: string,
  ) {
    return this.workSiteService.findAll(userId, search);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.workSiteService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkSiteDto,
  ) {
    return this.workSiteService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.workSiteService.remove(userId, id);
  }
}
