import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  type Notification,
  type User,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toPagedResult } from '../posts/post-views';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

type NotificationClient = Prisma.TransactionClient | PrismaService;

type NotificationListItem = {
  id: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: Date;
  actor: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
  } | null;
  post: {
    id: string;
    type: string;
    serviceCategory: string | null;
    title: string;
    city: string;
  } | null;
  comment: null;
  conversationId: string | null;
  summary: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prismaService: PrismaService) {}

  async listNotifications(userId: string, dto: ListNotificationsQueryDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const where = {
      userId,
      ...(dto.type ? { type: dto.type } : {}),
    };

    const [notifications, total] = await Promise.all([
      this.prismaService.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prismaService.notification.count({ where }),
    ]);

    const items = await Promise.all(
      notifications.map((notification) =>
        this.toNotificationListItem(notification),
      ),
    );

    return toPagedResult(items, page, pageSize, total);
  }

  async markRead(notificationId: string, userId: string) {
    const notification = await this.prismaService.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found.');
    }

    if (notification.isRead) {
      return {
        id: notificationId,
        isRead: true,
      };
    }

    const updated = await this.prismaService.notification.updateMany({
      where: {
        id: notificationId,
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    if (updated.count !== 1) {
      throw new NotFoundException('Notification not found.');
    }

    return {
      id: notificationId,
      isRead: true,
    };
  }

  async markAllRead(userId: string) {
    const updated = await this.prismaService.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return {
      updatedCount: updated.count,
    };
  }

  async createNotification(
    tx: NotificationClient,
    data: {
      userId: string;
      actorId: string | null;
      type: NotificationType;
      postId: string | null;
      commentId: string | null;
      conversationId: string | null;
    },
  ) {
    return tx.notification.create({
      data: {
        ...data,
        isRead: false,
      },
    });
  }

  private async toNotificationListItem(
    notification: Notification,
  ): Promise<NotificationListItem> {
    const [actor, post] = await Promise.all([
      notification.actorId
        ? this.prismaService.user.findUnique({
            where: { id: notification.actorId },
          })
        : Promise.resolve(null),
      notification.postId
        ? this.prismaService.post.findUnique({
            where: { id: notification.postId },
          })
        : Promise.resolve(null),
    ]);

    return {
      id: notification.id,
      type: notification.type,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      actor: actor
        ? {
            id: actor.id,
            nickname: actor.nickname,
            avatarUrl: actor.avatarUrl,
          }
        : null,
      post: post
        ? {
            id: post.id,
            type: post.type,
            serviceCategory: post.serviceCategory,
            title: post.title,
            city: post.city,
          }
        : null,
      comment: null,
      conversationId: notification.conversationId,
      summary: this.buildSummary(notification, post ?? null, actor ?? null),
    };
  }

  private buildSummary(
    notification: Notification,
    post: { title: string } | null,
    actor: Pick<User, 'nickname'> | null,
  ) {
    const title = post?.title ?? '帖子';
    const actorName = actor?.nickname ?? '对方';

    switch (notification.type) {
      case NotificationType.CONTACT_REQUEST:
        return `收到《${title}》的联系申请`;
      case NotificationType.CONTACT_APPROVED:
        return `《${title}》的联系申请已通过`;
      case NotificationType.LIKE_POST:
        return `${actorName} 赞了你的帖子`;
      case NotificationType.COMMENT_POST:
      case NotificationType.REPLY_COMMENT:
        return `${actorName} 评论了你的帖子`;
      default:
        return '新通知';
    }
  }
}
