import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PanEntryDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  pan: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateCompanySettingsDto {
  @IsOptional() @IsString() @MaxLength(150) companyName?: string;
  @IsOptional() @IsString() @MaxLength(250) tagline?: string;
  @IsOptional() @IsString() @MaxLength(100) regNo?: string;
  @IsOptional() @IsString() @MaxLength(30) gstin?: string;
  @IsOptional() @IsString() @MaxLength(100) phone?: string;
  @IsOptional() @IsString() @MaxLength(150) email?: string;
  @IsOptional() @IsString() @MaxLength(400) address?: string;
  @IsOptional() @IsString() @MaxLength(150) signatoryName?: string;

  /** PNG/JPEG/WebP data URL, or '' to remove the logo (about 700 KB at most) */
  @IsOptional()
  @IsString()
  @MaxLength(1_000_000)
  @Matches(/^$|^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, {
    message: 'Logo must be a PNG, JPEG or WebP image',
  })
  logo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PanEntryDto)
  pans?: PanEntryDto[];
}
