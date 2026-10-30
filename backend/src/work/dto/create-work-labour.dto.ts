import { IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkLabourDto {
  @IsOptional()
  @IsString()
  labourId?: string;

  @IsNotEmpty()
  @IsString()
  labourName: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  wage: number;
}
