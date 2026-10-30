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
import { LabourService } from './labour.service';
import { CreateLabourDto } from './dto/create-labour.dto';
import { UpdateLabourDto } from './dto/update-labour.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('labours')
export class LabourController {
  constructor(private readonly labourService: LabourService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() createLabourDto: CreateLabourDto) {
    return this.labourService.create(userId, createLabourDto);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('search') search?: string,
  ) {
    return this.labourService.findAll(userId, search);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.labourService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() updateLabourDto: UpdateLabourDto,
  ) {
    return this.labourService.update(userId, id, updateLabourDto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.labourService.remove(userId, id);
  }
}
