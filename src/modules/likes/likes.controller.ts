import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ok } from '../../common/response/api-response';
import { CurrentMiniappUser } from '../auth/current-miniapp-user.decorator';
import { MiniappAuthGuard } from '../auth/miniapp-auth.guard';
import type { AuthenticatedMiniappUser } from '../auth/auth.types';
import { LikesService } from './likes.service';

@Controller()
@UseGuards(MiniappAuthGuard)
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post('posts/:id/like')
  @HttpCode(200)
  async likePost(
    @Param('id') postId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
  ) {
    return ok(await this.likesService.likePost(postId, user));
  }

  @Post('posts/:id/like/delete')
  @HttpCode(200)
  async unlikePost(
    @Param('id') postId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
  ) {
    return ok(await this.likesService.unlikePost(postId, user));
  }
}
