import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ok } from '../../common/response/api-response';
import { CurrentAdminUser } from '../auth/current-admin-user.decorator';
import type { AuthenticatedAdminUser } from '../auth/auth.types';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AdminReviewQueryDto } from './dto/admin-review-query.dto';
import { OfflineReviewDto, RejectReviewDto } from './dto/review-reason.dto';
import { ReviewsService } from './reviews.service';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('reviews/pending')
  @HttpCode(200)
  async getPendingReviews(@Query() dto: AdminReviewQueryDto) {
    return ok(await this.reviewsService.getPendingReviews(dto));
  }

  @Post('reviews/:postId')
  @HttpCode(200)
  async getReviewDetail(@Param('postId') postId: string) {
    return ok(await this.reviewsService.getReviewDetail(postId));
  }

  @Post('reviews/:postId/approve')
  @HttpCode(200)
  async approve(
    @Param('postId') postId: string,
    @CurrentAdminUser() adminUser: AuthenticatedAdminUser,
  ) {
    return ok(await this.reviewsService.approve(postId, adminUser.id));
  }

  @Post('reviews/:postId/reject')
  @HttpCode(200)
  async reject(
    @Param('postId') postId: string,
    @CurrentAdminUser() adminUser: AuthenticatedAdminUser,
    @Body() dto: RejectReviewDto,
  ) {
    return ok(await this.reviewsService.reject(postId, adminUser.id, dto.reason));
  }

  @Post('reviews/:postId/offline')
  @HttpCode(200)
  async offline(
    @Param('postId') postId: string,
    @CurrentAdminUser() adminUser: AuthenticatedAdminUser,
    @Body() dto: OfflineReviewDto,
  ) {
    return ok(await this.reviewsService.offline(postId, adminUser.id, dto.reason));
  }

  @Post('posts/online')
  @HttpCode(200)
  async getOnlinePosts(@Query() dto: AdminReviewQueryDto) {
    return ok(await this.reviewsService.getOnlinePosts(dto));
  }
}
