import {
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateQuotationItemDto } from './create-quotation-item.dto';
import { QuotationPageDto } from './quotation-page.dto';

export class UpdateQuotationDto {
  @IsOptional()
  @IsString()
  quotationNo?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  workSiteId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  gstPercent?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items?: CreateQuotationItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pan?: string;

  @IsOptional()
  @IsIn(['ITEMS', 'WRITTEN'])
  kind?: 'ITEMS' | 'WRITTEN';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationPageDto)
  pages?: QuotationPageDto[];
}
