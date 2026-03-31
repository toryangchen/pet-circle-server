import { PostStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export class MyPostsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}
