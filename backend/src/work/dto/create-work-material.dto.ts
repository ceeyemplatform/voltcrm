import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkMaterialDto {
  @IsNotEmpty()
  @IsString()
  materialName: string;

  @IsNumber()
  @Type(() => Number)
  quantityIssued: number;

  @IsNumber()
  @Type(() => Number)
  quantityUsed: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  variance?: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
