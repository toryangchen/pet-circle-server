import { NotificationType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../posts/dto/pagination-query.dto';

export class ListNotificationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}
