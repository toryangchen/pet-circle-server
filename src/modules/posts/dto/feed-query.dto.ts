import { PostType, ServiceCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export class FeedQueryDto extends PaginationQueryDto {
  @IsEnum(PostType)
  channel!: PostType;

  @IsOptional()
  @IsEnum(ServiceCategory)
  serviceCategory?: ServiceCategory;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  city?: string;
}
