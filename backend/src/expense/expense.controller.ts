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
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateExpenseDto) {
    return this.expenseService.create(userId, dto);
  }

  @Get('summary')
  getSummary(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('workId') workId?: string,
    @Query('workCode') workCode?: string,
    @Query('paymentMode') paymentMode?: string,
  ) {
    return this.expenseService.getSummary(userId, {
      startDate,
      endDate,
      type,
      category,
      search,
      workId,
      workCode,
      paymentMode,
    });
  }

  @Get('totals')
  getTotals(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('workId') workId?: string,
    @Query('workCode') workCode?: string,
    @Query('paymentMode') paymentMode?: string,
  ) {
    return this.expenseService.getTotals(userId, {
      startDate,
      endDate,
      type,
      category,
      search,
      workId,
      workCode,
      paymentMode,
    });
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('workId') workId?: string,
    @Query('workCode') workCode?: string,
    @Query('paymentMode') paymentMode?: string,
  ) {
    return this.expenseService.findAll(userId, {
      startDate,
      endDate,
      type,
      category,
      search,
      workId,
      workCode,
      paymentMode,
    });
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.expenseService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenseService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.expenseService.remove(userId, id);
  }
}
