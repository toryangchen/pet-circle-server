import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConversationStatus,
  ConversationMessageType,
  MessageSenderType,
  NotificationType,
  PostStatus,
  PostType,
  Prisma,
  type User,
} from '@prisma/client';
import { PhoneAuthorizationRequiredException } from '../../common/exceptions/phone-authorization-required.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

type ConversationPayload = {
  conversationId: string;
  status: ConversationStatus;
  created: boolean;
};

type ConversationDetail = {
  id: string;
  status: ConversationStatus;
  post: {
    id: string;
    type: PostType;
    serviceCategory: string | null;
    title: string;
    city: string;
  } | null;
  messages: Array<{
    senderType: MessageSenderType;
    messageType: ConversationMessageType;
    content: string;
    createdAt: Date;
  }>;
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async requestContact(
    postId: string,
    initiator: User,
  ): Promise<ConversationPayload> {
    if (!initiator.phoneAuthorized) {
      throw new PhoneAuthorizationRequiredException();
    }

    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
    });

    if (
      !post ||
      post.type !== PostType.SERVICE ||
      post.status !== PostStatus.APPROVED
    ) {
      throw new ConflictException('Only approved service posts can be requested.');
    }

    if (post.authorId === initiator.id) {
      throw new ConflictException('The author cannot request contact on own post.');
    }

    const existingConversation = await this.prismaService.conversation.findUnique(
      {
        where: {
          postId_initiatorId: {
            postId,
            initiatorId: initiator.id,
          },
        },
      },
    );

    if (existingConversation) {
      return {
        conversationId: existingConversation.id,
        status: existingConversation.status,
        created: false,
      };
    }

    const created = await this.prismaService.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const conversation = await tx.conversation.create({
          data: {
            postId,
            initiatorId: initiator.id,
            receiverId: post.authorId,
            status: ConversationStatus.PENDING,
          },
        });

        await tx.conversationMessage.create({
          data: {
            conversationId: conversation.id,
            senderType: MessageSenderType.SYSTEM,
            messageType: ConversationMessageType.REQUEST_CONTACT,
            content: `我对您发布的《${post.title}》很感兴趣，请求交换联系方式`,
          },
        });

        await this.notificationsService.createNotification(tx, {
          userId: post.authorId,
          actorId: initiator.id,
          type: NotificationType.CONTACT_REQUEST,
          postId: post.id,
          commentId: null,
          conversationId: conversation.id,
        });

        return conversation;
      },
    );

    return {
      conversationId: created.id,
      status: created.status,
      created: true,
    };
  }

  async getConversation(conversationId: string, viewerId: string) {
    const conversation = await this.prismaService.conversation.findUnique({
      where: { id: conversationId },
    });

    if (
      !conversation ||
      (conversation.initiatorId !== viewerId && conversation.receiverId !== viewerId)
    ) {
      throw new NotFoundException('Conversation not found.');
    }

    const [post, messages] = await Promise.all([
      this.prismaService.post.findUnique({
        where: { id: conversation.postId },
      }),
      this.prismaService.conversationMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return this.toConversationDetail(conversation, post ?? null, messages);
  }

  async approveConversation(conversationId: string, viewerId: string) {
    const conversation = await this.prismaService.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.receiverId !== viewerId) {
      throw new NotFoundException('Conversation not found.');
    }

    if (conversation.status === ConversationStatus.APPROVED) {
      return {
        conversationId,
        status: ConversationStatus.APPROVED,
      };
    }

    if (conversation.status !== ConversationStatus.PENDING) {
      throw new ConflictException('Conversation is not pending.');
    }

    const post = await this.prismaService.post.findUnique({
      where: { id: conversation.postId },
    });

    const contact = await this.prismaService.postContact.findUnique({
      where: { postId: conversation.postId },
    });

    if (!post || !contact) {
      throw new ConflictException('Conversation contact data is unavailable.');
    }

    await this.prismaService.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.conversation.updateMany({
        where: {
          id: conversationId,
          receiverId: viewerId,
          status: ConversationStatus.PENDING,
        },
        data: {
          status: ConversationStatus.APPROVED,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Conversation is not pending.');
      }

      await tx.conversationMessage.create({
        data: {
          conversationId,
          senderType: MessageSenderType.SYSTEM,
          messageType: ConversationMessageType.SHARE_WECHAT,
          content: contact.wechatId ?? contact.phone ?? '',
        },
      });

      await this.notificationsService.createNotification(tx, {
        userId: conversation.initiatorId,
        actorId: viewerId,
        type: NotificationType.CONTACT_APPROVED,
        postId: conversation.postId,
        commentId: null,
        conversationId,
      });
    });

    return {
      conversationId,
      status: ConversationStatus.APPROVED,
    };
  }

  private toConversationDetail(
    conversation: {
      id: string;
      status: ConversationStatus;
      postId: string;
    },
    post: {
      id: string;
      type: PostType;
      serviceCategory: string | null;
      title: string;
      city: string;
    } | null,
    messages: Array<{
      senderType: MessageSenderType;
      messageType: ConversationMessageType;
      content: string;
      createdAt: Date;
    }>,
  ): ConversationDetail {
    return {
      id: conversation.id,
      status: conversation.status,
      post: post
        ? {
            id: post.id,
            type: post.type,
            serviceCategory: post.serviceCategory,
            title: post.title,
            city: post.city,
          }
        : null,
      messages: messages.slice(0, 3).map((message) => ({
        senderType: message.senderType,
        messageType: message.messageType,
        content: message.content,
        createdAt: message.createdAt,
      })),
    };
  }
}
