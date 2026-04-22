import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AdminUserRole,
  AdminUserStatus,
  PostStatus,
  PostType,
  ReviewAction,
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
import { AdminTokenService } from '../src/modules/auth/admin-token.service';
import { MiniappTokenService } from '../src/modules/auth/miniapp-token.service';
import { PrismaService } from '../src/prisma/prisma.service';

type TestUser = {
  id: string;
  openid: string;
  unionid: string | null;
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

type TestAdminUser = {
  id: string;
  username: string;
  passwordHash: string;
  role: AdminUserRole;
  status: AdminUserStatus;
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
  coverAssetId: string | null;
  publishedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  completedAt: Date | null;
  offlineAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TestPostAsset = {
  id: string;
  postId: string;
  type: 'IMAGE';
  url: string;
  sortOrder: number;
  createdAt: Date;
};

type TestPostContact = {
  id: string;
  postId: string;
  wechatId: string | null;
  phone: string | null;
  contactName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TestAdoptionDetail = {
  id: string;
  postId: string;
  petType: string;
  age: string;
  gender: string;
  neutered: boolean;
  adoptionRequirements: string;
  createdAt: Date;
  updatedAt: Date;
};

type TestSecondHandDetail = {
  id: string;
  postId: string;
  itemType: string;
  itemCondition: string;
  price: string;
  createdAt: Date;
  updatedAt: Date;
};

type TestHomeFeedingDetail = {
  id: string;
  postId: string;
  serviceArea: string;
  availableTime: string;
  price: string;
  createdAt: Date;
  updatedAt: Date;
};

type TestBoardingDetail = {
  id: string;
  postId: string;
  boardingEnvironment: string;
  acceptedPetTypes: string[];
  price: string;
  createdAt: Date;
  updatedAt: Date;
};

type TestReviewLog = {
  id: string;
  postId: string;
  reviewerId: string;
  action: ReviewAction;
  reason: string | null;
  createdAt: Date;
};

type TestFavorite = {
  id: string;
  postId: string;
  userId: string;
  createdAt: Date;
};

describe('Posts and Reviews (e2e)', () => {
  let app: INestApplication<App>;
  let miniappTokenService: MiniappTokenService;
  let adminTokenService: AdminTokenService;

  let users: TestUser[];
  let adminUsers: TestAdminUser[];
  let posts: TestPost[];
  let postAssets: TestPostAsset[];
  let postContacts: TestPostContact[];
  let adoptionDetails: TestAdoptionDetail[];
  let secondHandDetails: TestSecondHandDetail[];
  let homeFeedingDetails: TestHomeFeedingDetail[];
  let boardingDetails: TestBoardingDetail[];
  let reviewLogs: TestReviewLog[];
  let favorites: TestFavorite[];

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
    adminUser: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { id?: string; username?: string };
        }): Promise<TestAdminUser | null> => {
          if (where.id) {
            return adminUsers.find((user) => user.id === where.id) ?? null;
          }

          if (where.username) {
            return (
              adminUsers.find((user) => user.username === where.username) ?? null
            );
          }

          return null;
        },
      ),
    },
    post: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: Partial<TestPost>;
        }): Promise<TestPost> => {
          const createdAt = new Date('2026-03-31T10:00:00.000Z');
          const post: TestPost = {
            id: `post-${posts.length + 1}`,
            type: data.type as PostType,
            serviceCategory: (data.serviceCategory as ServiceCategory | null) ?? null,
            title: data.title as string,
            content: data.content as string,
            city: data.city as string,
            status: (data.status as PostStatus) ?? PostStatus.PENDING,
            authorId: data.authorId as string,
            coverAssetId: (data.coverAssetId as string | null) ?? null,
            publishedAt: (data.publishedAt as Date | null) ?? null,
            approvedAt: (data.approvedAt as Date | null) ?? null,
            rejectedAt: (data.rejectedAt as Date | null) ?? null,
            completedAt: (data.completedAt as Date | null) ?? null,
            offlineAt: (data.offlineAt as Date | null) ?? null,
            createdAt,
            updatedAt: createdAt,
          };
          posts.push(post);
          return post;
        },
      ),
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
      findMany: jest.fn(
        async ({
          where,
          skip,
          take,
        }: {
          where?: Record<string, unknown>;
          skip?: number;
          take?: number;
        }): Promise<Record<string, unknown>[]> => {
          const matched = filterPosts(where)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
            .slice(skip ?? 0, (skip ?? 0) + (take ?? Number.MAX_SAFE_INTEGER));

          return matched.map((post) => hydratePost(post));
        },
      ),
      count: jest.fn(
        async ({
          where,
        }: {
          where?: Record<string, unknown>;
        }): Promise<number> => filterPosts(where).length,
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Partial<TestPost>;
        }): Promise<{ count: number }> => {
          const matched = filterPosts(where);

          for (const post of matched) {
            Object.assign(post, data, {
              updatedAt: new Date('2026-03-31T12:00:00.000Z'),
            });
          }

          return { count: matched.length };
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<TestPost>;
        }): Promise<Record<string, unknown>> => {
          const post = posts.find((candidate) => candidate.id === where.id);
          if (!post) {
            throw new Error(`Post not found: ${where.id}`);
          }

          Object.assign(post, data, {
            updatedAt: new Date('2026-03-31T12:00:00.000Z'),
          });

          return hydratePost(post);
        },
      ),
    },
    postAsset: {
      createMany: jest.fn(
        async ({
          data,
        }: {
          data: Array<Pick<TestPostAsset, 'postId' | 'url' | 'sortOrder'>>;
        }) => {
          for (const item of data) {
            postAssets.push({
              id: `asset-${postAssets.length + 1}`,
              postId: item.postId,
              type: 'IMAGE',
              url: item.url,
              sortOrder: item.sortOrder,
              createdAt: new Date('2026-03-31T10:00:00.000Z'),
            });
          }

          return { count: data.length };
        },
      ),
    },
    postContact: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: Pick<
            TestPostContact,
            'postId' | 'wechatId' | 'phone' | 'contactName'
          >;
        }) => {
          const contact: TestPostContact = {
            id: `contact-${postContacts.length + 1}`,
            postId: data.postId,
            wechatId: data.wechatId,
            phone: data.phone,
            contactName: data.contactName,
            createdAt: new Date('2026-03-31T10:00:00.000Z'),
            updatedAt: new Date('2026-03-31T10:00:00.000Z'),
          };
          postContacts.push(contact);
          return contact;
        },
      ),
    },
    adoptionDetail: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: Omit<TestAdoptionDetail, 'id' | 'createdAt' | 'updatedAt'>;
        }) => {
          const detail: TestAdoptionDetail = {
            ...data,
            id: `adoption-${adoptionDetails.length + 1}`,
            createdAt: new Date('2026-03-31T10:00:00.000Z'),
            updatedAt: new Date('2026-03-31T10:00:00.000Z'),
          };
          adoptionDetails.push(detail);
          return detail;
        },
      ),
    },
    secondHandDetail: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: Omit<TestSecondHandDetail, 'id' | 'createdAt' | 'updatedAt'>;
        }) => {
          const detail: TestSecondHandDetail = {
            ...data,
            id: `second-hand-${secondHandDetails.length + 1}`,
            createdAt: new Date('2026-03-31T10:00:00.000Z'),
            updatedAt: new Date('2026-03-31T10:00:00.000Z'),
          };
          secondHandDetails.push(detail);
          return detail;
        },
      ),
    },
    homeFeedingDetail: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: Omit<TestHomeFeedingDetail, 'id' | 'createdAt' | 'updatedAt'>;
        }) => {
          const detail: TestHomeFeedingDetail = {
            ...data,
            id: `home-feeding-${homeFeedingDetails.length + 1}`,
            createdAt: new Date('2026-03-31T10:00:00.000Z'),
            updatedAt: new Date('2026-03-31T10:00:00.000Z'),
          };
          homeFeedingDetails.push(detail);
          return detail;
        },
      ),
    },
    boardingDetail: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: Omit<TestBoardingDetail, 'id' | 'createdAt' | 'updatedAt'>;
        }) => {
          const detail: TestBoardingDetail = {
            ...data,
            id: `boarding-${boardingDetails.length + 1}`,
            createdAt: new Date('2026-03-31T10:00:00.000Z'),
            updatedAt: new Date('2026-03-31T10:00:00.000Z'),
          };
          boardingDetails.push(detail);
          return detail;
        },
      ),
    },
    reviewLog: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: Pick<TestReviewLog, 'postId' | 'reviewerId' | 'action' | 'reason'>;
        }) => {
          const log: TestReviewLog = {
            id: `review-log-${reviewLogs.length + 1}`,
            postId: data.postId,
            reviewerId: data.reviewerId,
            action: data.action,
            reason: data.reason,
            createdAt: new Date('2026-03-31T11:00:00.000Z'),
          };
          reviewLogs.push(log);
          return log;
        },
      ),
      findMany: jest.fn(
        async ({
          where,
        }: {
          where?: { postId?: string; action?: ReviewAction };
        }) =>
          reviewLogs.filter(
            (log) =>
              (where?.postId === undefined || log.postId === where.postId) &&
              (where?.action === undefined || log.action === where.action),
          ),
      ),
    },
    favorite: {
      findMany: jest.fn(
        async ({
          where,
        }: {
          where?: { userId?: string; postId?: { in?: string[] } };
        }): Promise<TestFavorite[]> =>
          favorites.filter((favorite) => {
            if (where?.userId && favorite.userId !== where.userId) {
              return false;
            }

            if (
              where?.postId?.in &&
              !where.postId.in.includes(favorite.postId)
            ) {
              return false;
            }

            return true;
          }),
      ),
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { postId_userId: { postId: string; userId: string } };
        }): Promise<TestFavorite | null> =>
          favorites.find(
            (favorite) =>
              favorite.postId === where.postId_userId.postId &&
              favorite.userId === where.postId_userId.userId,
          ) ?? null,
      ),
    },
  };

  beforeEach(async () => {
    users = [];
    adminUsers = [];
    posts = [];
    postAssets = [];
    postContacts = [];
    adoptionDetails = [];
    secondHandDetails = [];
    homeFeedingDetails = [];
    boardingDetails = [];
    reviewLogs = [];
    favorites = [];

    prismaService.onModuleInit.mockReset();
    prismaService.$transaction.mockClear();
    prismaService.user.findUnique.mockClear();
    prismaService.adminUser.findUnique.mockClear();
    prismaService.post.create.mockClear();
    prismaService.post.findUnique.mockClear();
    prismaService.post.findMany.mockClear();
    prismaService.post.count.mockClear();
    prismaService.post.updateMany.mockClear();
    prismaService.post.update.mockClear();
    prismaService.postAsset.createMany.mockClear();
    prismaService.postContact.create.mockClear();
    prismaService.adoptionDetail.create.mockClear();
    prismaService.secondHandDetail.create.mockClear();
    prismaService.homeFeedingDetail.create.mockClear();
    prismaService.boardingDetail.create.mockClear();
    prismaService.reviewLog.create.mockClear();
    prismaService.reviewLog.findMany.mockClear();
    prismaService.favorite.findMany.mockClear();
    prismaService.favorite.findUnique.mockClear();

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
    adminTokenService = app.get(AdminTokenService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('publishes a pet-social post directly as approved', async () => {
    const author = seedUser({ phoneAuthorized: true });

    await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .send({
        type: 'PET_SOCIAL',
        title: '猫咪春天第一次出门晒太阳',
        content: '今天带家里猫咪出去晒太阳，真的很乖',
        city: '西安',
        images: ['https://example.com/pet-social-1.jpg'],
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 0,
          message: 'ok',
          data: {
            id: 'post-1',
            status: 'APPROVED',
          },
        });
      });
  });

  it('rejects publish when phone is not authorized with the spec error code', async () => {
    const author = seedUser({ phoneAuthorized: false });

    await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .send({
        type: 'PET_SOCIAL',
        title: '未绑定手机号也发帖',
        content: '这条应该被拦截',
        city: '西安',
        images: ['https://example.com/pet-social-2.jpg'],
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe(40006);
      });
  });

  it('publishes a service post with matching detail and contact data', async () => {
    const author = seedUser({ phoneAuthorized: true });

    await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .send({
        type: 'SERVICE',
        serviceCategory: 'HOME_FEEDING',
        title: '西安未央区上门喂养接单',
        content: '可拍照反馈、可铲屎换水',
        city: '西安',
        images: ['https://example.com/service-1.jpg'],
        contact: {
          wechatId: 'petfriend-li',
          phone: '13812345678',
        },
        homeFeedingDetail: {
          serviceArea: '未央区/雁塔区',
          availableTime: '工作日晚间/周末全天',
          price: '30',
        },
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          id: 'post-1',
          status: 'APPROVED',
        });
      });
  });

  it('publishes a service post without contact data for miniapp publish flow', async () => {
    const author = seedUser({ phoneAuthorized: true });

    await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .send({
        type: 'SERVICE',
        serviceCategory: 'BOARDING',
        title: '国庆期间可寄养小型犬',
        content: '家里有独立房间，每天会拍照反馈',
        city: '西安',
        images: [
          'https://example.com/service-boarding-1.jpg',
          'https://example.com/service-boarding-2.jpg',
        ],
        boardingDetail: {
          boardingEnvironment: '家庭寄养，独立活动区域',
          acceptedPetTypes: ['小型犬'],
          price: '120/天',
        },
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          id: 'post-1',
          status: 'APPROVED',
        });
      });
  });

  it('rejects mismatched service category and detail payloads', async () => {
    const author = seedUser({ phoneAuthorized: true });

    await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .send({
        type: 'SERVICE',
        serviceCategory: 'ADOPTION',
        title: '错误的详情组合',
        content: '这里故意提交不匹配的 detail',
        city: '西安',
        images: ['https://example.com/service-invalid.jpg'],
        contact: {
          wechatId: 'wrong-detail',
        },
        homeFeedingDetail: {
          serviceArea: '未央区',
          availableTime: '周末',
          price: '20',
        },
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe(40001);
      });
  });

  it('returns only approved posts in the public feed', async () => {
    const author = seedUser({ phoneAuthorized: true, nickname: '已审核作者' });
    const viewer = seedUser({ phoneAuthorized: true, nickname: '收藏用户' });
    const approvedPost = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.BOARDING,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '可以短期寄养',
      content: '单独房间，接受短期寄养',
    });
    seedAsset(approvedPost.id, 'https://example.com/feed-approved.jpg');
    seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.BOARDING,
      status: PostStatus.PENDING,
      authorId: author.id,
      title: '待审核寄养',
      content: '这条不该出现在 feed',
    });
    seedFavorite(approvedPost.id, viewer.id);

    await request(app.getHttpServer())
      .get('/api/posts/feed')
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .query({
        channel: 'SERVICE',
        serviceCategory: 'BOARDING',
        page: 1,
        pageSize: 10,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.items).toHaveLength(1);
        expect(body.data.items[0]).toMatchObject({
          id: approvedPost.id,
          type: 'SERVICE',
          serviceCategory: 'BOARDING',
          author: '已审核作者',
          authorAvatarUrl: author.avatarUrl,
          viewerState: {
            favorited: true,
          },
        });
      });
  });

  it('rejects a non-author trying to view a non-approved detail page', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const viewer = seedUser({ phoneAuthorized: true, nickname: '其他用户' });
    const pendingPost = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.ADOPTION,
      status: PostStatus.PENDING,
      authorId: author.id,
      title: '待审核猫咪领养',
      content: '还没审核通过',
    });
    seedAsset(pendingPost.id, 'https://example.com/pending-adoption.jpg');
    seedAdoptionDetail(pendingPost.id);
    seedContact(pendingPost.id);

    await request(app.getHttpServer())
      .get(`/api/posts/${pendingPost.id}`)
      .set('Authorization', bearer(miniappTokenService.sign(viewer.id)))
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe(40004);
      });
  });

  it('returns reject reason in my posts list', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const rejectedPost = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.SECOND_HAND,
      status: PostStatus.REJECTED,
      authorId: author.id,
      title: '二手猫爬架',
      content: '刚被驳回的帖子',
    });
    seedReviewLog(rejectedPost.id, ReviewAction.REJECT, '标题与内容不符');

    await request(app.getHttpServer())
      .get('/api/posts/my')
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .query({ page: 1, pageSize: 10 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.items).toEqual([
          expect.objectContaining({
            id: rejectedPost.id,
            status: 'REJECTED',
            rejectReason: '标题与内容不符',
          }),
        ]);
      });
  });

  it('allows an author to offline an approved service post', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const servicePost = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.HOME_FEEDING,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '上门喂养接单中',
      content: '作者主动下架',
      approvedAt: new Date('2026-03-31T09:30:00.000Z'),
    });

    await request(app.getHttpServer())
      .patch(`/api/posts/${servicePost.id}/offline`)
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          id: servicePost.id,
          status: 'OFFLINE',
        });
      });
  });

  it('only allows approved service posts to be offlined by the author', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const pendingServicePost = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.HOME_FEEDING,
      status: PostStatus.PENDING,
      authorId: author.id,
      title: '待审核服务帖',
      content: '不能作者主动下架',
    });
    const rejectedServicePost = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.BOARDING,
      status: PostStatus.REJECTED,
      authorId: author.id,
      title: '已驳回服务帖',
      content: '也不能作者主动下架',
    });
    const petSocialPost = seedPost({
      type: PostType.PET_SOCIAL,
      serviceCategory: null,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '宠物圈内容',
      content: '不支持下架成服务完成流',
      approvedAt: new Date('2026-03-31T09:50:00.000Z'),
    });

    for (const post of [pendingServicePost, rejectedServicePost, petSocialPost]) {
      await request(app.getHttpServer())
        .patch(`/api/posts/${post.id}/offline`)
        .set('Authorization', bearer(miniappTokenService.sign(author.id)))
        .expect(409)
        .expect(({ body }) => {
          expect(body.code).toBe(40005);
        });
    }
  });

  it('only allows service posts to be marked as completed', async () => {
    const author = seedUser({ phoneAuthorized: true });
    const petSocialPost = seedPost({
      type: PostType.PET_SOCIAL,
      serviceCategory: null,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '我家狗狗的日常',
      content: '宠物圈帖子不能标记完成',
      approvedAt: new Date('2026-03-31T09:30:00.000Z'),
    });
    const servicePost = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.BOARDING,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '寄养服务已成交',
      content: '服务帖可以标记完成',
      approvedAt: new Date('2026-03-31T09:35:00.000Z'),
    });

    await request(app.getHttpServer())
      .patch(`/api/posts/${petSocialPost.id}/complete`)
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe(40005);
      });

    await request(app.getHttpServer())
      .patch(`/api/posts/${servicePost.id}/complete`)
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          id: servicePost.id,
          status: 'COMPLETED',
        });
      });
  });

  it('lists pending reviews and shows review detail for admins', async () => {
    const admin = seedAdmin();
    const author = seedUser({
      phoneAuthorized: true,
      phone: '13812345678',
      nickname: '待审核作者',
    });
    const pendingPost = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.ADOPTION,
      status: PostStatus.PENDING,
      authorId: author.id,
      title: '西安猫咪领养',
      content: '等待审核中',
    });
    seedAsset(pendingPost.id, 'https://example.com/review-detail.jpg');
    seedAdoptionDetail(pendingPost.id);
    seedContact(pendingPost.id);

    await request(app.getHttpServer())
      .get('/api/admin/reviews/pending')
      .set('Authorization', bearer(adminTokenService.sign(admin.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.items).toEqual([
          expect.objectContaining({
            id: pendingPost.id,
            status: 'PENDING',
            author: expect.objectContaining({
              id: author.id,
              phone: '13812345678',
            }),
          }),
        ]);
      });

    await request(app.getHttpServer())
      .get(`/api/admin/reviews/${pendingPost.id}`)
      .set('Authorization', bearer(adminTokenService.sign(admin.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          id: pendingPost.id,
          status: 'PENDING',
          author: {
            id: author.id,
            phone: '13812345678',
          },
          reviewLogs: [],
        });
      });
  });

  it('keeps service contact private for non-authors and inactive viewers', async () => {
    const author = seedUser({ phoneAuthorized: true, nickname: '作者' });
    const activeViewer = seedUser({
      phoneAuthorized: true,
      nickname: '激活查看者',
    });
    const inactiveViewer = seedUser({
      phoneAuthorized: true,
      nickname: '停用查看者',
      status: UserStatus.DISABLED,
    });
    const approvedPost = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.ADOPTION,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '审核通过的领养信息',
      content: '联系方式不应直接公开',
      approvedAt: new Date('2026-03-31T09:30:00.000Z'),
    });
    seedAsset(approvedPost.id, 'https://example.com/adoption-public.jpg');
    seedAdoptionDetail(approvedPost.id);
    seedContact(approvedPost.id);

    await request(app.getHttpServer())
      .get(`/api/posts/${approvedPost.id}`)
      .set('Authorization', bearer(miniappTokenService.sign(activeViewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.contact).toEqual({ visible: false });
      });

    await request(app.getHttpServer())
      .get(`/api/posts/${approvedPost.id}`)
      .set('Authorization', bearer(miniappTokenService.sign(inactiveViewer.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.contact).toEqual({ visible: false });
      });

    await request(app.getHttpServer())
      .get(`/api/posts/${approvedPost.id}`)
      .set('Authorization', bearer(miniappTokenService.sign(author.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.contact).toEqual({
          visible: true,
          wechatId: 'contact-wechat',
          phone: '13800000000',
          contactName: '联系人',
        });
      });
  });

  it('supports admin review approve, reject, offline, and online listing flows', async () => {
    const admin = seedAdmin();
    const author = seedUser({ phoneAuthorized: true });
    const pendingToApprove = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.HOME_FEEDING,
      status: PostStatus.PENDING,
      authorId: author.id,
      title: '待通过的服务帖',
      content: '准备通过',
    });
    const pendingToReject = seedPost({
      type: PostType.PET_SOCIAL,
      serviceCategory: null,
      status: PostStatus.PENDING,
      authorId: author.id,
      title: '待拒绝的宠物圈帖子',
      content: '准备拒绝',
    });
    const onlinePost = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.BOARDING,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '已上线寄养服务',
      content: '准备被运营下架',
      approvedAt: new Date('2026-03-31T09:45:00.000Z'),
    });

    await request(app.getHttpServer())
      .post(`/api/admin/reviews/${pendingToApprove.id}/approve`)
      .set('Authorization', bearer(adminTokenService.sign(admin.id)))
      .send({})
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          id: pendingToApprove.id,
          status: 'APPROVED',
        });
      });

    await request(app.getHttpServer())
      .post(`/api/admin/reviews/${pendingToReject.id}/reject`)
      .set('Authorization', bearer(adminTokenService.sign(admin.id)))
      .send({
        reason: '标题与内容不符',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          id: pendingToReject.id,
          status: 'REJECTED',
        });
      });

    await request(app.getHttpServer())
      .post(`/api/admin/reviews/${onlinePost.id}/offline`)
      .set('Authorization', bearer(adminTokenService.sign(admin.id)))
      .send({
        reason: '内容过期或不适合继续展示',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          id: onlinePost.id,
          status: 'OFFLINE',
        });
      });

    await request(app.getHttpServer())
      .get('/api/admin/posts/online')
      .set('Authorization', bearer(adminTokenService.sign(admin.id)))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.items).toEqual([
          expect.objectContaining({
            id: pendingToApprove.id,
            status: 'APPROVED',
          }),
        ]);
      });
  });

  it('supports admin review list filtering by type and service category', async () => {
    const admin = seedAdmin();
    const author = seedUser({ phoneAuthorized: true });
    const matchedPendingPost = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.BOARDING,
      status: PostStatus.PENDING,
      authorId: author.id,
      title: '寄养待审核',
      content: '这条应被筛出来',
    });
    seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.HOME_FEEDING,
      status: PostStatus.PENDING,
      authorId: author.id,
      title: '喂养待审核',
      content: '不应出现在 BOARDING 过滤里',
    });
    const matchedOnlinePost = seedPost({
      type: PostType.SERVICE,
      serviceCategory: ServiceCategory.BOARDING,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '寄养已上线',
      content: '这条应被筛出来',
      approvedAt: new Date('2026-03-31T09:55:00.000Z'),
    });
    seedPost({
      type: PostType.PET_SOCIAL,
      serviceCategory: null,
      status: PostStatus.APPROVED,
      authorId: author.id,
      title: '宠物圈已上线',
      content: '不应出现在服务过滤里',
      approvedAt: new Date('2026-03-31T09:56:00.000Z'),
    });

    await request(app.getHttpServer())
      .get('/api/admin/reviews/pending')
      .set('Authorization', bearer(adminTokenService.sign(admin.id)))
      .query({
        type: 'SERVICE',
        serviceCategory: 'BOARDING',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.items).toEqual([
          expect.objectContaining({
            id: matchedPendingPost.id,
            type: 'SERVICE',
            serviceCategory: 'BOARDING',
          }),
        ]);
      });

    await request(app.getHttpServer())
      .get('/api/admin/posts/online')
      .set('Authorization', bearer(adminTokenService.sign(admin.id)))
      .query({
        type: 'SERVICE',
        serviceCategory: 'BOARDING',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.items).toEqual([
          expect.objectContaining({
            id: matchedOnlinePost.id,
            type: 'SERVICE',
            serviceCategory: 'BOARDING',
          }),
        ]);
      });
  });

  it('rejects whitespace-only admin reject reasons', async () => {
    const admin = seedAdmin();
    const author = seedUser({ phoneAuthorized: true });
    const pendingPost = seedPost({
      type: PostType.PET_SOCIAL,
      serviceCategory: null,
      status: PostStatus.PENDING,
      authorId: author.id,
      title: '待驳回帖子',
      content: '需要驳回原因校验',
    });

    await request(app.getHttpServer())
      .post(`/api/admin/reviews/${pendingPost.id}/reject`)
      .set('Authorization', bearer(adminTokenService.sign(admin.id)))
      .send({
        reason: '   ',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe(40001);
      });
  });

  function seedUser(overrides: Partial<TestUser> = {}): TestUser {
    const user: TestUser = {
      id: overrides.id ?? `user-${users.length + 1}`,
      openid: overrides.openid ?? `openid-${users.length + 1}`,
      unionid: overrides.unionid ?? null,
      nickname: overrides.nickname ?? '测试用户',
      avatarUrl: overrides.avatarUrl ?? 'https://example.com/avatar.jpg',
      phone: overrides.phone ?? null,
      phoneAuthorized: overrides.phoneAuthorized ?? false,
      profileAuthorized: overrides.profileAuthorized ?? true,
      cityDefault: overrides.cityDefault ?? '西安',
      status: overrides.status ?? UserStatus.ACTIVE,
      createdAt: overrides.createdAt ?? new Date('2026-03-31T08:00:00.000Z'),
      updatedAt: overrides.updatedAt ?? new Date('2026-03-31T08:00:00.000Z'),
    };
    users.push(user);
    return user;
  }

  function seedAdmin(overrides: Partial<TestAdminUser> = {}): TestAdminUser {
    const admin: TestAdminUser = {
      id: overrides.id ?? `admin-${adminUsers.length + 1}`,
      username: overrides.username ?? `admin-${adminUsers.length + 1}`,
      passwordHash: overrides.passwordHash ?? 'unused-hash',
      role: overrides.role ?? AdminUserRole.OPERATOR,
      status: overrides.status ?? AdminUserStatus.ACTIVE,
      createdAt: overrides.createdAt ?? new Date('2026-03-31T08:00:00.000Z'),
      updatedAt: overrides.updatedAt ?? new Date('2026-03-31T08:00:00.000Z'),
    };
    adminUsers.push(admin);
    return admin;
  }

  function seedPost(overrides: Partial<TestPost>): TestPost {
    const post: TestPost = {
      id: overrides.id ?? `seed-post-${posts.length + 1}`,
      type: overrides.type ?? PostType.PET_SOCIAL,
      serviceCategory: overrides.serviceCategory ?? null,
      title: overrides.title ?? '默认标题',
      content: overrides.content ?? '默认内容',
      city: overrides.city ?? '西安',
      status: overrides.status ?? PostStatus.PENDING,
      authorId: overrides.authorId ?? users[0]?.id ?? 'user-1',
      coverAssetId: overrides.coverAssetId ?? null,
      publishedAt: overrides.publishedAt ?? null,
      approvedAt: overrides.approvedAt ?? null,
      rejectedAt: overrides.rejectedAt ?? null,
      completedAt: overrides.completedAt ?? null,
      offlineAt: overrides.offlineAt ?? null,
      createdAt: overrides.createdAt ?? new Date(`2026-03-31T0${posts.length}:00:00.000Z`),
      updatedAt: overrides.updatedAt ?? new Date(`2026-03-31T0${posts.length}:00:00.000Z`),
    };
    posts.push(post);
    return post;
  }

  function seedAsset(postId: string, url: string) {
    const asset: TestPostAsset = {
      id: `seed-asset-${postAssets.length + 1}`,
      postId,
      type: 'IMAGE',
      url,
      sortOrder: postAssets.filter((candidate) => candidate.postId === postId).length,
      createdAt: new Date('2026-03-31T08:30:00.000Z'),
    };
    postAssets.push(asset);
    const post = posts.find((candidate) => candidate.id === postId);
    if (post && !post.coverAssetId) {
      post.coverAssetId = asset.id;
    }
    return asset;
  }

  function seedContact(postId: string) {
    const contact: TestPostContact = {
      id: `seed-contact-${postContacts.length + 1}`,
      postId,
      wechatId: 'contact-wechat',
      phone: '13800000000',
      contactName: '联系人',
      createdAt: new Date('2026-03-31T08:40:00.000Z'),
      updatedAt: new Date('2026-03-31T08:40:00.000Z'),
    };
    postContacts.push(contact);
    return contact;
  }

  function seedAdoptionDetail(postId: string) {
    const detail: TestAdoptionDetail = {
      id: `seed-adoption-${adoptionDetails.length + 1}`,
      postId,
      petType: '猫',
      age: '6个月',
      gender: '母',
      neutered: false,
      adoptionRequirements: '需接受回访',
      createdAt: new Date('2026-03-31T08:35:00.000Z'),
      updatedAt: new Date('2026-03-31T08:35:00.000Z'),
    };
    adoptionDetails.push(detail);
    return detail;
  }

  function seedReviewLog(
    postId: string,
    action: ReviewAction,
    reason: string | null,
  ) {
    const log: TestReviewLog = {
      id: `seed-review-log-${reviewLogs.length + 1}`,
      postId,
      reviewerId: adminUsers[0]?.id ?? 'admin-1',
      action,
      reason,
      createdAt: new Date(
        `2026-03-31T1${reviewLogs.length}:00:00.000Z`,
      ),
    };
    reviewLogs.push(log);
    return log;
  }

  function seedFavorite(postId: string, userId: string) {
    const favorite: TestFavorite = {
      id: `seed-favorite-${favorites.length + 1}`,
      postId,
      userId,
      createdAt: new Date('2026-03-31T08:50:00.000Z'),
    };
    favorites.push(favorite);
    return favorite;
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
      assets: postAssets
        .filter((asset) => asset.postId === post.id)
        .sort((left, right) => left.sortOrder - right.sortOrder),
      contact: postContacts.find((contact) => contact.postId === post.id) ?? null,
      adoptionDetail:
        adoptionDetails.find((detail) => detail.postId === post.id) ?? null,
      secondHandDetail:
        secondHandDetails.find((detail) => detail.postId === post.id) ?? null,
      homeFeedingDetail:
        homeFeedingDetails.find((detail) => detail.postId === post.id) ?? null,
      boardingDetail:
        boardingDetails.find((detail) => detail.postId === post.id) ?? null,
      reviewLogs: reviewLogs
        .filter((log) => log.postId === post.id)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
      _count: {
        likes: 0,
        comments: 0,
        favorites: favorites.filter((favorite) => favorite.postId === post.id).length,
      },
    };
  }

  function bearer(token: string) {
    return `Bearer ${token}`;
  }
});
