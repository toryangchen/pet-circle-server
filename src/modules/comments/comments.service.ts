import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommentStatus,
  NotificationType,
  PostStatus,
  Prisma,
  type User,
} from '@prisma/client';
import { CommentLevelExceededException } from '../../common/exceptions/comment-level-exceeded.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { commentInclude, toCommentTree, type HydratedComment } from './comments.views';
import { CommentContentDto } from './dto/comment-content.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listComments(postId: string) {
    await this.findApprovedPostOrThrow(postId);

    const comments = await this.prismaService.comment.findMany({
      where: {
        postId,
        status: CommentStatus.NORMAL,
      },
      include: commentInclude,
      orderBy: {
        createdAt: 'asc',
      },
    });

    return toCommentTree(comments as HydratedComment[]);
  }

  async createComment(postId: string, user: User, dto: CommentContentDto) {
    const post = await this.findApprovedPostOrThrow(postId);

    const created = await this.prismaService.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const comment = await tx.comment.create({
          data: {
            postId,
            userId: user.id,
            parentId: null,
            rootId: null,
            content: dto.content,
            status: CommentStatus.NORMAL,
          },
        });

        await this.notifyComment(tx, {
          postId: post.id,
          actorId: user.id,
          recipientId: post.authorId,
          type: NotificationType.COMMENT_POST,
          commentId: comment.id,
        });

        return comment;
      },
    );

    return {
      id: created.id,
    };
  }

  async replyComment(parentCommentId: string, user: User, dto: CommentContentDto) {
    const parent = await this.prismaService.comment.findUnique({
      where: { id: parentCommentId },
      include: commentInclude,
    });

    if (!parent || parent.status !== CommentStatus.NORMAL) {
      throw new NotFoundException('Comment not found.');
    }

    if (parent.parentId) {
      throw new CommentLevelExceededException();
    }

    const post = await this.findApprovedPostOrThrow(parent.postId);

    const created = await this.prismaService.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const comment = await tx.comment.create({
          data: {
            postId: parent.postId,
            userId: user.id,
            parentId: parent.id,
            rootId: parent.id,
            content: dto.content,
            status: CommentStatus.NORMAL,
          },
        });

        await this.notifyComment(tx, {
          postId: post.id,
          actorId: user.id,
          recipientId: parent.userId,
          type: NotificationType.REPLY_COMMENT,
          commentId: comment.id,
        });

        return comment;
      },
    );

    return {
      id: created.id,
    };
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prismaService.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('Only the comment author can delete it.');
    }

    if (comment.status === CommentStatus.DELETED) {
      return {
        id: commentId,
        status: CommentStatus.DELETED,
      };
    }

    const updated = await this.prismaService.comment.updateMany({
      where: {
        id: commentId,
        userId,
        status: CommentStatus.NORMAL,
      },
      data: {
        status: CommentStatus.DELETED,
      },
    });

    if (updated.count !== 1) {
      throw new NotFoundException('Comment not found.');
    }

    return {
      id: commentId,
      status: CommentStatus.DELETED,
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

  private async notifyComment(
    tx: Prisma.TransactionClient,
    params: {
      postId: string;
      actorId: string;
      recipientId: string;
      type: NotificationType;
      commentId: string;
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
      commentId: params.commentId,
      conversationId: null,
    });
  }
}
