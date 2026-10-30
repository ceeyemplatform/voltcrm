import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateWorkLabourDto } from './create-work-labour.dto';
import { CreateWorkMaterialDto } from './create-work-material.dto';

export class CreateWorkDto {
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsNotEmpty()
  @IsString()
  workCode: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  workOrder?: string;

  @IsOptional()
  @IsDateString()
  woDate?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  contractorAmount?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  gstMillNumber?: string;

  @IsOptional()
  @IsDateString()
  gstDate?: string;

  @IsOptional()
  @IsString()
  electricalSection?: string;

  @IsOptional()
  @IsString()
  typeOfWork?: string;

  @IsOptional()
  @IsString()
  workSiteId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkLabourDto)
  labours?: CreateWorkLabourDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkMaterialDto)
  materials?: CreateWorkMaterialDto[];

  @IsOptional()
  dailyDetails?: any;
}
