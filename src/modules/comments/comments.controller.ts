import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ok } from '../../common/response/api-response';
import { CurrentMiniappUser } from '../auth/current-miniapp-user.decorator';
import { MiniappAuthGuard } from '../auth/miniapp-auth.guard';
import type { AuthenticatedMiniappUser } from '../auth/auth.types';
import { CommentContentDto } from './dto/comment-content.dto';
import { CommentsService } from './comments.service';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('posts/:id/comments/list')
  @UseGuards(MiniappAuthGuard)
  @HttpCode(200)
  async listComments(
    @Param('id') postId: string,
    @CurrentMiniappUser() _user: AuthenticatedMiniappUser,
  ) {
    return ok(await this.commentsService.listComments(postId));
  }

  @Post('posts/:id/comments')
  @UseGuards(MiniappAuthGuard)
  async createComment(
    @Param('id') postId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Body() dto: CommentContentDto,
  ) {
    return ok(await this.commentsService.createComment(postId, user, dto));
  }

  @Post('comments/:id/replies')
  @UseGuards(MiniappAuthGuard)
  async replyComment(
    @Param('id') commentId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Body() dto: CommentContentDto,
  ) {
    return ok(await this.commentsService.replyComment(commentId, user, dto));
  }

  @Post('comments/:id/delete')
  @HttpCode(200)
  @UseGuards(MiniappAuthGuard)
  async deleteComment(
    @Param('id') commentId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
  ) {
    return ok(await this.commentsService.deleteComment(commentId, user.id));
  }
}
