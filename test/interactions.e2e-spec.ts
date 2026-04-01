import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CommentStatus,
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
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
};

type TestComment = {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  rootId: string | null;
  content: string;
  status: CommentStatus;
  createdAt: Date;
  updatedAt: Date;
};

type TestLike = {
  id: string;
  postId: string;
  userId: string;
  createdAt: Date;
};

type TestFavorite = {
  id: string;
  postId: string;
  userId: string;
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

describe('Interactions (e2e)', () => {
  let app: INestApplication<App>;
  let miniappTokenService: MiniappTokenService;

  let users: TestUser[];
  let posts: TestPost[];
  let comments: TestComment[];
  let likes: TestLike[];
  let favorites: TestFavorite[];
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
        }) => {
          const post = posts.find((candidate) => candidate.id === where.id);
          return post ? hydratePost(post) : null;
        },
      ),
      findMany: jest.fn(
        async ({
          where,
        }: {
          where?: { id?: { in: string[] } };
        }) => {
          const ids = where?.id?.in ?? [];
          return posts
            .filter((post) => ids.includes(post.id))
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
            .map((post) => hydratePost(post));
        },
      ),
      count: jest.fn(
        async ({
          where,
        }: {
          where?: Record<string, unknown>;
        }) => filterPosts(where).length,
      ),
    },
    comment: {
      findMany: jest.fn(
        async ({
          where,
        }: {
          where?: { postId?: string; status?: CommentStatus };
        }) =>
          comments
            .filter(
              (comment) =>
                (where?.postId === undefined || comment.postId === where.postId) &&
                (where?.status === undefined || comment.status === where.status),
            )
            .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
            .map((comment) => hydrateComment(comment)),
      ),
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { id: string };
        }) => {
          const comment = comments.find((candidate) => candidate.id === where.id);
          return comment ? hydrateComment(comment) : null;
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: Pick<TestComment, 'postId' | 'userId' | 'parentId' | 'rootId' | 'content' | 'status'>;
        }) => {
          const createdAt = new Date(`2026-04-01T0${comments.length}:00:00.000Z`);
          const comment: TestComment = {
            id: `comment-${comments.length + 1}`,
            postId: data.postId,
            userId: data.userId,
            parentId: data.parentId ?? null,
            rootId: data.rootId ?? null,
            content: data.content,
            status: data.status ?? CommentStatus.NORMAL,
            createdAt,
            updatedAt: createdAt,
          };
          comments.push(comment);
          return hydrateComment(comment);
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id?: string; userId?: string; status?: CommentStatus };
          data: Partial<TestComment>;
        }) => {
          const matched = comments.filter((comment) => {
            return (
              (where.id === undefined || comment.id === where.id) &&
              (where.userId === undefined || comment.userId === where.userId) &&
              (where.status === undefined || comment.status === where.status)
            );
          });

          for (const comment of matched) {
            Object.assign(comment, data, {
              updatedAt: new Date('2026-04-01T10:00:00.000Z'),
            });
          }

          return { count: matched.length };
        },
      ),
    },
    like: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { postId_userId: { postId: string; userId: string } };
        }) =>
          likes.find(
            (like) =>
              like.postId === where.postId_userId.postId &&
              like.userId === where.postId_userId.userId,
          ) ?? null,
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: Pick<TestLike, 'postId' | 'userId'>;
        }) => {
          const like: TestLike = {
            id: `like-${likes.length + 1}`,
            postId: data.postId,
            userId: data.userId,
            createdAt: new Date(`2026-04-01T0${likes.length}:10:00.000Z`),
          };
          likes.push(like);
          return like;
        },
      ),
      delete: jest.fn(
        async ({
          where,
        }: {
          where: { postId_userId: { postId: string; userId: string } };
        }) => {
          const index = likes.findIndex(
            (like) =>
              like.postId === where.postId_userId.postId &&
              like.userId === where.postId_userId.userId,
          );

          if (index >= 0) {
            likes.splice(index, 1);
          }
        },
      ),
    },
    favorite: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { postId_userId: { postId: string; userId: string } };
        }) =>
          favorites.find(
            (favorite) =>
              favorite.postId === where.postId_userId.postId &&
              favorite.userId === where.postId_userId.userId,
          ) ?? null,
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: Pick<TestFavorite, 'postId' | 'userId'>;
        }) => {
          const favorite: TestFavorite = {
            id: `favorite-${favorites.length + 1}`,
            postId: data.postId,
            userId: data.userId,
            createdAt: new Date(`2026-04-01T0${favorites.length}:20:00.000Z`),
          };
          favorites.push(favorite);
          return favorite;
        },
      ),
      delete: jest.fn(
        async ({
          where,
        }: {
          where: { postId_userId: { postId: string; userId: string } };
        }) => {
          const index = favorites.findIndex(
            (favorite) =>
              favorite.postId === where.postId_userId.postId &&
              favorite.userId === where.postId_userId.userId,
          );

          if (index >= 0) {
            favorites.splice(index, 1);
          }
        },
      ),
      findMany: jest.fn(
        async ({
          where,
        }: {
          where?: { userId?: string };
        }) =>
          favorites
            .filter((favorite) => where?.userId === undefined || favorite.userId === where.userId)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
            .map((favorite) => ({
              ...favorite,
              post: hydratePost(posts.find((post) => post.id === favorite.postId)!),
            })),
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
            createdAt: new Date(`2026-04-01T0${notifications.length}:30:00.000Z`),
          };
          notifications.push(notification);
          return notification;
        },
      ),
    },
  };

  beforeEach(async () => {
    users = [];
    posts = [];
    comments = [];
    likes = [];
    favorites = [];
    notifications = [];

    prismaService.onModuleInit.mockReset();
    prismaService.$transaction.mockClear();
    prismaService.user.findUnique.mockClear();
    prismaService.post.findUnique.mockClear();
    prismaService.post.findMany.mockClear();
    prismaService.post.count.mockClear();
    prismaService.comment.findMany.mockClear();
    prismaService.comment.findUnique.mockClear();
    prismaService.comment.create.mockClear();
    prismaService.comment.updateMany.mockClear();
    prismaService.like.findUnique.mockClear();
    prismaService.like.create.mockClear();
    prismaService.like.delete.mockClear();
    prismaService.favorite.findUnique.mockClear();
    prismaService.favorite.create.mockClear();
    prismaService.favorite.delete.mockClear();
    prismaService.favorite.findMany.mockClear();
    prismaService.notification.findUnique.mockClear();
    prismaService.notification.findMany.mockClear();
    prismaService.notification.count.mockClear();
    prismaService.notification.updateMany.mockClear();
    prismaService.notification.create.mockClear();

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

  it('creates comments, replies, notifications, and viewer state for interactions', async () => {
    const author = seedUser({ phoneAuthorized: true, nickname: '作者' });
    const commenter = seedUser({ phoneAuthorized: true, nickname: '评论者' });
    const replier = seedUser({ phoneAuthorized: true, nickname: '回复者' });
    const viewer = seedUser({ phoneAuthorized: true, nickname: '查看者' });
    const post = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.HOME_FEEDING,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '上门喂养服务',
      content: '欢迎评论和收藏',
    });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/comments`)
      .set('Authorization', bearer(miniappTokenService.sign(commenter.id)))
      .send({ content: '太实用了' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: 'comment-1' });
      });

    await request(app.getHttpServer())
      .post('/api/comments/comment-1/replies')
      .set('Authorization', bearer(miniappTokenService.sign(replier.id)))
      .send({ content: '我也觉得不错' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: 'comment-2' });
      });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/like`)
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: post.id, liked: true });
      });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/favorite`)
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: post.id, favorited: true });
      });

    await request(app.getHttpServer())
      .get(`/api/posts/${post.id}/comments`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.items).toEqual([
          expect.objectContaining({
            id: 'comment-1',
            content: '太实用了',
            replies: [
              expect.objectContaining({
                id: 'comment-2',
                content: '我也觉得不错',
              }),
            ],
          }),
        ]);
      });

    await request(app.getHttpServer())
      .get(`/api/posts/${post.id}`)
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.stats).toEqual({
          likeCount: 1,
          commentCount: 2,
          favoriteCount: 1,
        });
        expect(body.data.viewerState).toEqual({
          liked: true,
          favorited: true,
          phoneAuthorized: true,
        });
      });

    await request(app.getHttpServer())
      .get('/api/favorites/my')
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.items).toEqual([
          expect.objectContaining({
            id: post.id,
            type: 'SERVICE',
            serviceCategory: 'HOME_FEEDING',
          }),
        ]);
      });

    await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.items.some((item: { type: string }) => item.type === 'COMMENT_POST')).toBe(
          true,
        );
        expect(body.data.items.some((item: { type: string }) => item.type === 'LIKE_POST')).toBe(
          true,
        );
      });

    await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', bearer(miniappTokenService.sign(commenter.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.items.some((item: { type: string }) => item.type === 'REPLY_COMMENT')).toBe(
          true,
        );
      });
  });

  it('rejects replying to a second-level comment with the level error code', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const commenter = seedUser({ phoneAuthorized: true });
    const replier = seedUser({ phoneAuthorized: true });
    const post = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.ADOPTION,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '领养信息',
      content: '不能继续回复二级评论',
    });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/comments`)
      .set('Authorization', bearer(miniappTokenService.sign(commenter.id)))
      .send({ content: '一级评论' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/comments/comment-1/replies')
      .set('Authorization', bearer(miniappTokenService.sign(replier.id)))
      .send({ content: '二级回复' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/comments/comment-2/replies')
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .send({ content: '三级回复' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe(40007);
      });
  });

  it('rejects listing or creating comments for non-approved posts', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const commenter = seedUser({ phoneAuthorized: true });
    const pendingPost = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.HOME_FEEDING,
      status: PostStatus.PENDING,
      authorId: author.id,
      title: '待审核服务',
      content: '审核前不可评论',
    });

    await request(app.getHttpServer())
      .get(`/api/posts/${pendingPost.id}/comments`)
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe(40004);
      });

    await request(app.getHttpServer())
      .post(`/api/posts/${pendingPost.id}/comments`)
      .set('Authorization', bearer(miniappTokenService.sign(commenter.id)))
      .send({ content: '审核前留言' })
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe(40004);
      });
  });

  it('logically deletes comments and keeps repeated like and favorite calls idempotent', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const commenter = seedUser({ phoneAuthorized: true });
    const viewer = seedUser({ phoneAuthorized: true });
    const post = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.BOARDING,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '寄养服务',
      content: '删除和幂等要稳定',
    });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/comments`)
      .set('Authorization', bearer(miniappTokenService.sign(commenter.id)))
      .send({ content: '要删除的评论' })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/api/comments/comment-1')
      .set('Authorization', bearer(miniappTokenService.sign(commenter.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: 'comment-1', status: 'DELETED' });
      });

    await request(app.getHttpServer())
      .get(`/api/posts/${post.id}/comments`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.items).toEqual([]);
      });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/like`)
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: post.id, liked: true });
      });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/like`)
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: post.id, liked: true });
      });

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}/like`)
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: post.id, liked: false });
      });

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}/like`)
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: post.id, liked: false });
      });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/favorite`)
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: post.id, favorited: true });
      });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/favorite`)
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: post.id, favorited: true });
      });

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}/favorite`)
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: post.id, favorited: false });
      });

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}/favorite`)
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ id: post.id, favorited: false });
      });
  });

  it('rejects deleting comments for non-authors', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const commenter = seedUser({ phoneAuthorized: true });
    const otherUser = seedUser({ phoneAuthorized: true });
    const post = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.BOARDING,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '寄养服务',
      content: '只有评论作者能删',
    });

    await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/comments`)
      .set('Authorization', bearer(miniappTokenService.sign(commenter.id)))
      .send({ content: '不能让别人删' })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/api/comments/comment-1')
      .set('Authorization', bearer(miniappTokenService.sign(otherUser.id)))
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe(40003);
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
      createdAt: overrides.createdAt ?? new Date('2026-04-01T08:00:00.000Z'),
      updatedAt: overrides.updatedAt ?? new Date('2026-04-01T08:00:00.000Z'),
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
      createdAt: overrides.createdAt ?? new Date('2026-04-01T09:00:00.000Z'),
      updatedAt: overrides.updatedAt ?? new Date('2026-04-01T09:00:00.000Z'),
    };
    posts.push(post);
    return post;
  }

  function filterPosts(where: Record<string, unknown> = {}) {
    return posts.filter((post) => {
      return Object.entries(where).every(([key, value]) => {
        if (value === undefined) {
          return true;
        }

        const candidate = post[key as keyof TestPost];

        if (
          typeof value === 'object' &&
          value !== null &&
          'in' in value &&
          Array.isArray((value as { in: unknown[] }).in)
        ) {
          return (value as { in: unknown[] }).in.includes(candidate);
        }

        return candidate === value;
      });
    });
  }

  function hydratePost(post: TestPost) {
    return {
      ...post,
      author: users.find((candidate) => candidate.id === post.authorId) ?? null,
      assets: [],
      contact: null,
      adoptionDetail: null,
      secondHandDetail: null,
      homeFeedingDetail: null,
      boardingDetail: null,
      reviewLogs: [],
      _count: {
        likes: likes.filter((like) => like.postId === post.id).length,
        comments: comments.filter((comment) => comment.postId === post.id && comment.status === CommentStatus.NORMAL).length,
        favorites: favorites.filter((favorite) => favorite.postId === post.id).length,
      },
    };
  }

  function hydrateComment(comment: TestComment) {
    return {
      ...comment,
      user: users.find((candidate) => candidate.id === comment.userId) ?? null,
      post: posts.find((candidate) => candidate.id === comment.postId) ?? null,
    };
  }

  function bearer(token: string) {
    return `Bearer ${token}`;
  }
});
