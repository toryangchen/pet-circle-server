import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ok } from '../../common/response/api-response';
import { CurrentMiniappUser } from '../auth/current-miniapp-user.decorator';
import { MiniappAuthGuard } from '../auth/miniapp-auth.guard';
import { MiniappTokenService } from '../auth/miniapp-token.service';
import type { AuthenticatedMiniappUser } from '../auth/auth.types';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { MyPostsQueryDto } from './dto/my-posts-query.dto';
import { PostsService } from './posts.service';
import { ConversationsService } from '../conversations/conversations.service';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly conversationsService: ConversationsService,
    private readonly miniappTokenService: MiniappTokenService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get('feed')
  async getFeed(
    @Query() dto: FeedQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer = await this.resolveViewer(authorization);
    return ok(await this.postsService.getFeed(dto, viewer));
  }

  @Get('my')
  @UseGuards(MiniappAuthGuard)
  async getMyPosts(
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Query() dto: MyPostsQueryDto,
  ) {
    return ok(await this.postsService.getMyPosts(user.id, dto));
  }

  @Get(':id')
  async getDetail(
    @Param('id') postId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer = await this.resolveViewer(authorization);
    return ok(await this.postsService.getDetail(postId, viewer));
  }

  @Post()
  @UseGuards(MiniappAuthGuard)
  async createPost(
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Body() dto: CreatePostDto,
  ) {
    return ok(await this.postsService.createPost(user, dto));
  }

  @Post(':id/contact-request')
  @HttpCode(HttpStatus.OK)
  @UseGuards(MiniappAuthGuard)
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

  @Patch(':id/offline')
  @UseGuards(MiniappAuthGuard)
  async offlinePost(
    @Param('id') postId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
  ) {
    return ok(await this.postsService.offlinePost(postId, user.id));
  }

  @Patch(':id/complete')
  @UseGuards(MiniappAuthGuard)
  async completePost(
    @Param('id') postId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
  ) {
    return ok(await this.postsService.completePost(postId, user.id));
  }

  private async resolveViewer(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    try {
      const payload = this.miniappTokenService.verify(
        authorization.slice('Bearer '.length).trim(),
      );
      const user = await this.prismaService.user.findUnique({
        where: { id: payload.sub },
      });

      return user?.status === UserStatus.ACTIVE ? user : null;
    } catch {
      return null;
    }
  }
}
