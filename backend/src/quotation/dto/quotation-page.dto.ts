import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** One free text page of a quotation, stored as formatted HTML */
export class QuotationPageDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsString()
  @MaxLength(500000)
  html: string;

  /** Company header printed at the top of this page */
  @IsOptional()
  @IsBoolean()
  showHeader?: boolean;
}
