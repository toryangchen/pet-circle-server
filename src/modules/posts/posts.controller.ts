import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ok } from '../../common/response/api-response';
import { CurrentMiniappUser } from '../auth/current-miniapp-user.decorator';
import { MiniappAuthGuard } from '../auth/miniapp-auth.guard';
import type { AuthenticatedMiniappUser } from '../auth/auth.types';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { MyPostsQueryDto } from './dto/my-posts-query.dto';
import { PostsService } from './posts.service';
import { ConversationsService } from '../conversations/conversations.service';

@Controller('posts')
@UseGuards(MiniappAuthGuard)
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly conversationsService: ConversationsService,
  ) {}

  @Post('feed')
  @HttpCode(200)
  async getFeed(
    @Query() dto: FeedQueryDto,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
  ) {
    return ok(await this.postsService.getFeed(dto, user));
  }

  @Post('my')
  @HttpCode(200)
  async getMyPosts(
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Query() dto: MyPostsQueryDto,
  ) {
    return ok(await this.postsService.getMyPosts(user.id, dto));
  }

  @Post(':id')
  @HttpCode(200)
  async getDetail(
    @Param('id') postId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
  ) {
    return ok(await this.postsService.getDetail(postId, user));
  }

  @Post()
  async createPost(
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Body() dto: CreatePostDto,
  ) {
    return ok(await this.postsService.createPost(user, dto));
  }

  @Post(':id/contact-request')
  @HttpCode(HttpStatus.OK)
  async requestContact(
    @Param('id') postId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.conversationsService.requestContact(postId, user);
    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);

    return ok({
      conversationId: result.conversationId,
      status: result.status,
    });
  }

  @Post(':id/offline')
  @HttpCode(200)
  async offlinePost(
    @Param('id') postId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
  ) {
    return ok(await this.postsService.offlinePost(postId, user.id));
  }

  @Post(':id/complete')
  @HttpCode(200)
  async completePost(
    @Param('id') postId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
  ) {
    return ok(await this.postsService.completePost(postId, user.id));
  }
}
