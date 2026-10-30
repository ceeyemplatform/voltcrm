import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateWorkSiteDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
