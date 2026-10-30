import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanySettingsService } from './company-settings.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

@Controller('company-settings')
export class CompanySettingsController {
  constructor(private readonly service: CompanySettingsService) {}

  @Get()
  get(@CurrentUser('id') userId: string) {
    return this.service.get(userId);
  }

  @Put()
  update(@CurrentUser('id') userId: string, @Body() dto: UpdateCompanySettingsDto) {
    return this.service.update(userId, dto);
  }
}
