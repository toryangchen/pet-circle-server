import { PostType, ServiceCategory } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../posts/dto/pagination-query.dto';

export class AdminReviewQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @IsOptional()
  @IsEnum(ServiceCategory)
  serviceCategory?: ServiceCategory;
}
