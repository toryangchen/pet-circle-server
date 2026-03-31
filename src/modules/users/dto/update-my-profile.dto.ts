import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

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
}
