import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @IsNotEmpty()
  @IsString()
  category: string;

  @IsNotEmpty()
  @IsIn(['income', 'expense'])
  type: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  workId?: string;

  @IsOptional()
  @IsString()
  workCode?: string;

  @IsOptional()
  @IsString()
  workName?: string;

  @IsOptional()
  @IsString()
  personName?: string;

  @IsOptional()
  @IsString()
  paymentMode?: string;

  @IsOptional()
  isFlagged?: boolean;
}
