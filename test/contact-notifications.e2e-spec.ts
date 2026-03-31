import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConversationStatus,
  ConversationMessageType,
  MessageSenderType,
  NotificationType,
  PostStatus,
  PostType,
  ServiceCategory,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.DATABASE_URL =
  'mongodb://127.0.0.1:27017/pet_circle_test?directConnection=true';
process.env.JWT_SECRET = 'test-miniapp-secret';
process.env.WECHAT_APP_ID = 'wx-test-appid';
process.env.WECHAT_APP_SECRET = 'wx-test-secret';

import { AppModule } from '../src/app.module';
import { applyGlobalAppSetup } from '../src/app.setup';
import { MiniappTokenService } from '../src/modules/auth/miniapp-token.service';
import { PrismaService } from '../src/prisma/prisma.service';

type TestUser = {
  id: string;
  openid: string;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  phoneAuthorized: boolean;
  profileAuthorized: boolean;
  cityDefault: string | null;
  status: UserStatus;
};

type TestPost = {
  id: string;
  type: PostType;
  serviceCategory: ServiceCategory | null;
  title: string;
  content: string;
  city: string;
  status: PostStatus;
  authorId: string;
};

type TestPostContact = {
  postId: string;
  wechatId: string | null;
  phone: string | null;
  contactName: string | null;
};

type TestConversation = {
  id: string;
  postId: string;
  initiatorId: string;
  receiverId: string;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
};

type TestConversationMessage = {
  id: string;
  conversationId: string;
  senderType: MessageSenderType;
  messageType: ConversationMessageType;
  content: string;
  createdAt: Date;
};

type TestNotification = {
  id: string;
  userId: string;
  actorId: string | null;
  type: NotificationType;
  postId: string | null;
  commentId: string | null;
  conversationId: string | null;
  isRead: boolean;
  createdAt: Date;
};

describe('Contact requests and notifications (e2e)', () => {
  let app: INestApplication<App>;
  let miniappTokenService: MiniappTokenService;

  let users: TestUser[];
  let posts: TestPost[];
  let postContacts: TestPostContact[];
  let conversations: TestConversation[];
  let conversationMessages: TestConversationMessage[];
  let notifications: TestNotification[];

  const prismaService = {
    onModuleInit: jest.fn(),
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return input(prismaService);
      }

      return input;
    }),
    user: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { id?: string; openid?: string };
        }): Promise<TestUser | null> => {
          if (where.id) {
            return users.find((user) => user.id === where.id) ?? null;
          }

          if (where.openid) {
            return users.find((user) => user.openid === where.openid) ?? null;
          }

          return null;
        },
      ),
    },
    post: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { id: string };
        }): Promise<Record<string, unknown> | null> => {
          const post = posts.find((candidate) => candidate.id === where.id);
          return post ? hydratePost(post) : null;
        },
      ),
    },
    postContact: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { postId: string };
        }) =>
          postContacts.find((contact) => contact.postId === where.postId) ?? null,
      ),
    },
    conversation: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { id?: string; postId_initiatorId?: { postId: string; initiatorId: string } };
        }): Promise<Record<string, unknown> | null> => {
          if (where.id) {
            const conversation = conversations.find(
              (candidate) => candidate.id === where.id,
            );
            return conversation ? hydrateConversation(conversation) : null;
          }

          if (where.postId_initiatorId) {
            const conversation = conversations.find(
              (candidate) =>
                candidate.postId === where.postId_initiatorId?.postId &&
                candidate.initiatorId === where.postId_initiatorId?.initiatorId,
            );
            return conversation ? hydrateConversation(conversation) : null;
          }

          return null;
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: Pick<TestConversation, 'postId' | 'initiatorId' | 'receiverId' | 'status'>;
        }) => {
          const now = new Date('2026-04-01T00:00:00.000Z');
          const conversation: TestConversation = {
            id: `conversation-${conversations.length + 1}`,
            postId: data.postId,
            initiatorId: data.initiatorId,
            receiverId: data.receiverId,
            status: data.status,
            createdAt: now,
            updatedAt: now,
          };
          conversations.push(conversation);
          return conversation;
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; status?: ConversationStatus; receiverId?: string };
          data: Partial<TestConversation>;
        }) => {
          const matched = conversations.filter((conversation) => {
            return (
              conversation.id === where.id &&
              (where.status === undefined || conversation.status === where.status) &&
              (where.receiverId === undefined ||
                conversation.receiverId === where.receiverId)
            );
          });

          for (const conversation of matched) {
            Object.assign(conversation, data, {
              updatedAt: new Date('2026-04-01T01:00:00.000Z'),
            });
          }

          return { count: matched.length };
        },
      ),
    },
    conversationMessage: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: Pick<
            TestConversationMessage,
            'conversationId' | 'senderType' | 'messageType' | 'content'
          >;
        }) => {
          const message: TestConversationMessage = {
            id: `message-${conversationMessages.length + 1}`,
            conversationId: data.conversationId,
            senderType: data.senderType,
            messageType: data.messageType,
            content: data.content,
            createdAt: new Date(
              `2026-04-01T0${conversationMessages.length}:00:00.000Z`,
            ),
          };
          conversationMessages.push(message);
          return message;
        },
      ),
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: { conversationId: string };
        }) =>
          conversationMessages
            .filter((message) => message.conversationId === where.conversationId)
            .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
      ),
    },
    notification: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { id: string };
        }) =>
          notifications.find((notification) => notification.id === where.id) ?? null,
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: Pick<
            TestNotification,
            'userId' | 'actorId' | 'type' | 'postId' | 'commentId' | 'conversationId' | 'isRead'
          >;
        }) => {
          const notification: TestNotification = {
            id: `notification-${notifications.length + 1}`,
            userId: data.userId,
            actorId: data.actorId ?? null,
            type: data.type,
            postId: data.postId ?? null,
            commentId: data.commentId ?? null,
            conversationId: data.conversationId ?? null,
            isRead: data.isRead,
            createdAt: new Date(
              `2026-04-01T0${notifications.length}:10:00.000Z`,
            ),
          };
          notifications.push(notification);
          return notification;
        },
      ),
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: { userId: string; type?: NotificationType };
        }) =>
          notifications
            .filter(
              (notification) =>
                notification.userId === where.userId &&
                (where.type === undefined || notification.type === where.type),
            )
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
      ),
      count: jest.fn(
        async ({
          where,
        }: {
          where: { userId: string; type?: NotificationType };
        }) =>
          notifications.filter(
            (notification) =>
              notification.userId === where.userId &&
              (where.type === undefined || notification.type === where.type),
          ).length,
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id?: string; userId: string; isRead?: boolean };
          data: Partial<TestNotification>;
        }) => {
          const matched = notifications.filter((notification) => {
            return (
              notification.userId === where.userId &&
              (where.id === undefined || notification.id === where.id) &&
              (where.isRead === undefined || notification.isRead === where.isRead)
            );
          });

          for (const notification of matched) {
            Object.assign(notification, data);
          }

          return { count: matched.length };
        },
      ),
    },
  };

  beforeEach(async () => {
    users = [];
    posts = [];
    postContacts = [];
    conversations = [];
    conversationMessages = [];
    notifications = [];

    prismaService.onModuleInit.mockReset();
    prismaService.$transaction.mockClear();
    prismaService.user.findUnique.mockClear();
    prismaService.post.findUnique.mockClear();
    prismaService.postContact.findUnique.mockClear();
    prismaService.conversation.findUnique.mockClear();
    prismaService.conversation.create.mockClear();
    prismaService.conversation.updateMany.mockClear();
    prismaService.conversationMessage.create.mockClear();
    prismaService.conversationMessage.findMany.mockClear();
    prismaService.notification.create.mockClear();
    prismaService.notification.findUnique.mockClear();
    prismaService.notification.findMany.mockClear();
    prismaService.notification.count.mockClear();
    prismaService.notification.updateMany.mockClear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    applyGlobalAppSetup(app);
    await app.init();

    miniappTokenService = app.get(MiniappTokenService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates a contact request conversation and notification for a service post', async () => {
    const author = seedUser({ phoneAuthorized: true, nickname: '发布者' });
    const initiator = seedUser({ phoneAuthorized: true, nickname: '申请人' });
    const post = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.HOME_FEEDING,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '上门喂养接单',
      content: '需要联系人',
    });
    seedContact(post.id, {
      wechatId: 'author-wechat',
      phone: '13812345678',
      contactName: '发布者',
    });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/contact-request`)
      .set('Authorization', bearer(miniappTokenService.sign(initiator.id)))
      .expect(201)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          conversationId: 'conversation-1',
          status: 'PENDING',
        });
      });

    await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.items).toHaveLength(1);
        expect(body.data.items[0]).toMatchObject({
          type: 'CONTACT_REQUEST',
          conversationId: 'conversation-1',
          isRead: false,
        });
      });
  });

  it('returns contact request conversation detail with fixed system message', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const initiator = seedUser({ phoneAuthorized: true });
    const post = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.BOARDING,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '短期寄养',
      content: '欢迎申请',
    });
    seedContact(post.id, { wechatId: 'author-wechat', phone: null, contactName: null });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/contact-request`)
      .set('Authorization', bearer(miniappTokenService.sign(initiator.id)))
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/conversations/conversation-1')
      .set('Authorization', bearer(miniappTokenService.sign(initiator.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          id: 'conversation-1',
          status: 'PENDING',
          messages: [
            {
              senderType: 'SYSTEM',
              messageType: 'REQUEST_CONTACT',
              content: '我对您发布的《短期寄养》很感兴趣，请求交换联系方式',
            },
          ],
        });
      });
  });

  it('approves a contact request and sends approval notification', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const initiator = seedUser({ phoneAuthorized: true });
    const post = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.ADOPTION,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '猫咪领养',
      content: '可以私聊联系',
    });
    seedContact(post.id, {
      wechatId: 'author-wechat',
      phone: '13812345678',
      contactName: '发布者',
    });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/contact-request`)
      .set('Authorization', bearer(miniappTokenService.sign(initiator.id)))
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/conversations/conversation-1/approve')
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          conversationId: 'conversation-1',
          status: 'APPROVED',
        });
      });

    await request(app.getHttpServer())
      .get('/api/conversations/conversation-1')
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.messages).toEqual([
          expect.objectContaining({
            messageType: 'REQUEST_CONTACT',
          }),
          expect.objectContaining({
            senderType: 'SYSTEM',
            messageType: 'SHARE_WECHAT',
            content: 'author-wechat',
          }),
        ]);
      });

    await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', bearer(miniappTokenService.sign(initiator.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.items[0]).toMatchObject({
          type: 'CONTACT_APPROVED',
          conversationId: 'conversation-1',
        });
      });
  });

  it('does not allow a third party to view or approve another conversation', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const initiator = seedUser({ phoneAuthorized: true });
    const outsider = seedUser({ phoneAuthorized: true });
    const post = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.BOARDING,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '寄养服务',
      content: '只有双方可访问',
    });
    seedContact(post.id, { wechatId: 'author-wechat' });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/contact-request`)
      .set('Authorization', bearer(miniappTokenService.sign(initiator.id)))
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/conversations/conversation-1')
      .set('Authorization', bearer(miniappTokenService.sign(outsider.id)))
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe(40004);
      });

    await request(app.getHttpServer())
      .post('/api/conversations/conversation-1/approve')
      .set('Authorization', bearer(miniappTokenService.sign(outsider.id)))
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe(40004);
      });
  });

  it('keeps approve idempotent after a conversation is already approved', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const initiator = seedUser({ phoneAuthorized: true });
    const post = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.ADOPTION,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '领养信息',
      content: '重复同意不应重复发消息',
    });
    seedContact(post.id, { wechatId: 'author-wechat' });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/contact-request`)
      .set('Authorization', bearer(miniappTokenService.sign(initiator.id)))
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/conversations/conversation-1/approve')
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/conversations/conversation-1/approve')
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          conversationId: 'conversation-1',
          status: 'APPROVED',
        });
      });

    expect(
      conversationMessages.filter(
        (message) =>
          message.conversationId === 'conversation-1' &&
          message.messageType === ConversationMessageType.SHARE_WECHAT,
      ),
    ).toHaveLength(1);
  });

  it('marks notifications as read', async () => {
    const user = seedUser({ phoneAuthorized: true });
    notifications.push({
      id: 'notification-1',
      userId: user.id,
      actorId: null,
      type: NotificationType.CONTACT_REQUEST,
      postId: 'post-1',
      commentId: null,
      conversationId: 'conversation-1',
      isRead: false,
      createdAt: new Date('2026-04-01T01:00:00.000Z'),
    });

    await request(app.getHttpServer())
      .post('/api/notifications/notification-1/read')
      .set('Authorization', bearer(miniappTokenService.sign(user.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: 'notification-1', isRead: true });
      });

    await request(app.getHttpServer())
      .post('/api/notifications/notification-1/read')
      .set('Authorization', bearer(miniappTokenService.sign(user.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: 'notification-1', isRead: true });
      });

    notifications.push({
      id: 'notification-2',
      userId: user.id,
      actorId: null,
      type: NotificationType.CONTACT_APPROVED,
      postId: 'post-1',
      commentId: null,
      conversationId: 'conversation-1',
      isRead: false,
      createdAt: new Date('2026-04-01T02:00:00.000Z'),
    });

    await request(app.getHttpServer())
      .post('/api/notifications/read-all')
      .set('Authorization', bearer(miniappTokenService.sign(user.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.updatedCount).toBe(1);
      });
  });

  it('rejects contact requests for pet-social posts', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const initiator = seedUser({ phoneAuthorized: true });
    const post = seedPost({
      type: PostType.PET_SOCIAL,
      serviceCategory: null,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '宠物圈内容',
      content: '不允许联系申请',
    });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/contact-request`)
      .set('Authorization', bearer(miniappTokenService.sign(initiator.id)))
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe(40005);
      });
  });

  it('rejects contact requests when the initiator has not authorized phone binding', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const initiator = seedUser({ phoneAuthorized: false });
    const post = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.BOARDING,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '短期寄养',
      content: '需要手机号授权',
    });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/contact-request`)
      .set('Authorization', bearer(miniappTokenService.sign(initiator.id)))
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe(40006);
      });
  });

  it('returns the same conversation when the same initiator requests again', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const initiator = seedUser({ phoneAuthorized: true });
    const post = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.HOME_FEEDING,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '上门喂养',
      content: '同一人只能创建一次',
    });
    seedContact(post.id, { wechatId: 'author-wechat' });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/contact-request`)
      .set('Authorization', bearer(miniappTokenService.sign(initiator.id)))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/contact-request`)
      .set('Authorization', bearer(miniappTokenService.sign(initiator.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          conversationId: 'conversation-1',
          status: 'PENDING',
        });
      });
  });

  function seedUser(overrides: Partial<TestUser> = {}): TestUser {
    const user: TestUser = {
      id: overrides.id ?? `user-${users.length + 1}`,
      openid: overrides.openid ?? `openid-${users.length + 1}`,
      nickname: overrides.nickname ?? '测试用户',
      avatarUrl: overrides.avatarUrl ?? 'https://example.com/avatar.jpg',
      phone: overrides.phone ?? null,
      phoneAuthorized: overrides.phoneAuthorized ?? false,
      profileAuthorized: overrides.profileAuthorized ?? true,
      cityDefault: overrides.cityDefault ?? '西安',
      status: overrides.status ?? UserStatus.ACTIVE,
    };
    users.push(user);
    return user;
  }

  function seedPost(overrides: Partial<TestPost>): TestPost {
    const post: TestPost = {
      id: overrides.id ?? `post-${posts.length + 1}`,
      type: overrides.type ?? PostType.SERVICE,
      serviceCategory: overrides.serviceCategory ?? ServiceCategory.HOME_FEEDING,
      title: overrides.title ?? '默认标题',
      content: overrides.content ?? '默认内容',
      city: overrides.city ?? '西安',
      status: overrides.status ?? PostStatus.APPROVED,
      authorId: overrides.authorId ?? users[0]?.id ?? 'user-1',
    };
    posts.push(post);
    return post;
  }

  function seedContact(
    postId: string,
    overrides: Partial<TestPostContact> = {},
  ) {
    const contact: TestPostContact = {
      postId,
      wechatId: overrides.wechatId ?? 'contact-wechat',
      phone: overrides.phone ?? null,
      contactName: overrides.contactName ?? null,
    };
    postContacts.push(contact);
    return contact;
  }

  function hydratePost(post: TestPost) {
    return {
      ...post,
      author: users.find((candidate) => candidate.id === post.authorId) ?? null,
      contact: postContacts.find((contact) => contact.postId === post.id) ?? null,
    };
  }

  function hydrateConversation(conversation: TestConversation) {
    return {
      ...conversation,
      post: posts.find((candidate) => candidate.id === conversation.postId) ?? null,
      messages: conversationMessages.filter(
        (message) => message.conversationId === conversation.id,
      ),
    };
  }

  function bearer(token: string) {
    return `Bearer ${token}`;
  }
});
