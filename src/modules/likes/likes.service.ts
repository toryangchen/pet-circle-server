import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, PostStatus, Prisma, type User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LikesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async likePost(postId: string, user: User) {
    const post = await this.findApprovedPostOrThrow(postId);
    const existing = await this.prismaService.like.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    });

    if (!existing) {
      await this.prismaService.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.like.create({
          data: {
            postId,
            userId: user.id,
          },
        });

        await this.notifyOwner(tx, {
          postId,
          actorId: user.id,
          recipientId: post.authorId,
          type: NotificationType.LIKE_POST,
        });
      });
    }

    return {
      id: postId,
      liked: true,
    };
  }

  async unlikePost(postId: string, user: User) {
    await this.findApprovedPostOrThrow(postId);

    const existing = await this.prismaService.like.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    });

    if (existing) {
      await this.prismaService.like.delete({
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
      liked: false,
    };
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

  private async notifyOwner(
    tx: Prisma.TransactionClient,
    params: {
      postId: string;
      actorId: string;
      recipientId: string;
      type: NotificationType;
    },
  ) {
    if (params.recipientId === params.actorId) {
      return;
    }

    await this.notificationsService.createNotification(tx, {
      userId: params.recipientId,
      actorId: params.actorId,
      type: params.type,
      postId: params.postId,
      commentId: null,
      conversationId: null,
    });
  }
}
