import { IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateQuotationItemDto {
  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  qty: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rate: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsString()
  itemType?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  supplyRate?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  labourRate?: number;
}
