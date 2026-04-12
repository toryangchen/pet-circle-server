import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export const assetUploadKinds = ['avatar', 'post-image'] as const;

export type AssetUploadKind = (typeof assetUploadKinds)[number];

export class CreateCosStsDto {
  @IsEnum(assetUploadKinds)
  kind!: AssetUploadKind;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;
}
