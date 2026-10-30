import {
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateExpenseDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: string;

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
