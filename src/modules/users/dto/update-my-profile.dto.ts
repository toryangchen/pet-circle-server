import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @IsOptional()
  @IsUrl({
    require_tld: false,
  })
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  profileAuthorized?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  bgType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @IsOptional()
  @IsDateString()
  birthday?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  regionProvince?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  regionCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  regionDistrict?: string;
}
