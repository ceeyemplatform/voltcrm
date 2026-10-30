import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** One free text page of a quotation, stored as formatted HTML */
export class QuotationPageDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsString()
  @MaxLength(500000)
  html: string;
}
