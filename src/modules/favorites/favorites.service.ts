import { Injectable, NotFoundException } from '@nestjs/common';
import { PostStatus, type User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { postInclude, toFeedItem, toPagedResult } from '../posts/post-views';
import { FavoritesQueryDto } from './dto/favorites-query.dto';

@Injectable()
export class FavoritesService {
  constructor(private readonly prismaService: PrismaService) {}

  async favoritePost(postId: string, user: User) {
    await this.findApprovedPostOrThrow(postId);
    const existing = await this.prismaService.favorite.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    });

    if (!existing) {
      await this.prismaService.favorite.create({
        data: {
          postId,
          userId: user.id,
        },
      });
    }

    return {
      id: postId,
      favorited: true,
    };
  }

  async unfavoritePost(postId: string, user: User) {
    await this.findApprovedPostOrThrow(postId);
    const existing = await this.prismaService.favorite.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    });

    if (existing) {
      await this.prismaService.favorite.delete({
        where: {
          postId_userId: {
            postId,
            userId: user.id,
          },
        },
      });
    }

    return {
      id: postId,
      favorited: false,
    };
  }

  async listMyFavorites(userId: string, dto: FavoritesQueryDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;

    const favorites = await this.prismaService.favorite.findMany({
      where: {
        userId,
      },
      include: {
        post: {
          include: postInclude,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const items = favorites
      .slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
      .map((favorite) => toFeedItem(favorite.post, { favorited: true }));

    return toPagedResult(items, page, pageSize, favorites.length);
  }

  private async findApprovedPostOrThrow(postId: string) {
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
    });

    if (!post || post.status !== PostStatus.APPROVED) {
      throw new NotFoundException('Post not found.');
    }

    return post;
  }
}
