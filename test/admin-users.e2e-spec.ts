import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminUserRole, AdminUserStatus, PostStatus, PostType, UserStatus } from '@prisma/client';
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
import { PrismaService } from '../src/prisma/prisma.service';

type TestAdminUser = {
  id: string;
  username: string;
  passwordHash: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  createdAt: Date;
  updatedAt: Date;
};

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

type TestPost = {
  id: string;
  type: PostType;
  serviceCategory: null;
  title: string;
  content: string;
  city: string;
  status: PostStatus;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
};

describe('Admin Users (e2e)', () => {
  let app: INestApplication<App>;
  let adminTokenService: AdminTokenService;
  let adminUsers: TestAdminUser[];
  let users: TestUser[];
  let posts: TestPost[];

  const prismaService = {
    onModuleInit: jest.fn(),
    adminUser: {
      findUnique: jest.fn(
        async ({ where }: { where: { id?: string; username?: string } }) => {
          if (where.id) {
            return adminUsers.find((item) => item.id === where.id) ?? null;
          }

          if (where.username) {
            return adminUsers.find((item) => item.username === where.username) ?? null;
          }

          return null;
        },
      ),
    },
    user: {
      findMany: jest.fn(
        async ({
          where,
          skip,
          take,
          orderBy,
        }: {
          where?: {
            OR?: Array<{ nickname?: { contains: string }; phone?: { contains: string } }>;
          };
          skip?: number;
          take?: number;
          orderBy?: { createdAt: 'asc' | 'desc' };
        }) => {
          const keyword = where?.OR?.[0]?.nickname?.contains ?? where?.OR?.[1]?.phone?.contains;
          const matched = users
            .filter((item) => {
              if (!keyword) {
                return true;
              }

              return (
                (item.nickname ?? '').includes(keyword) || (item.phone ?? '').includes(keyword)
              );
            })
            .sort((left, right) =>
              orderBy?.createdAt === 'asc'
                ? left.createdAt.getTime() - right.createdAt.getTime()
                : right.createdAt.getTime() - left.createdAt.getTime(),
            );

          return matched.slice(skip ?? 0, (skip ?? 0) + (take ?? Number.MAX_SAFE_INTEGER));
        },
      ),
      count: jest.fn(
        async ({
          where,
        }: {
          where?: {
            OR?: Array<{ nickname?: { contains: string }; phone?: { contains: string } }>;
          };
        }) => {
          const keyword = where?.OR?.[0]?.nickname?.contains ?? where?.OR?.[1]?.phone?.contains;
          return users.filter((item) => {
            if (!keyword) {
              return true;
            }

            return (
              (item.nickname ?? '').includes(keyword) || (item.phone ?? '').includes(keyword)
            );
          }).length;
        },
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return users.find((item) => item.id === where.id) ?? null;
      }),
    },
    post: {
      count: jest.fn(async ({ where }: { where?: { authorId?: string } }) => {
        return posts.filter((item) => item.authorId === where?.authorId).length;
      }),
      findMany: jest.fn(
        async ({
          where,
          take,
          orderBy,
        }: {
          where?: { authorId?: string };
          take?: number;
          orderBy?: { createdAt: 'asc' | 'desc' };
        }) => {
          const matched = posts
            .filter((item) => item.authorId === where?.authorId)
            .sort((left, right) =>
              orderBy?.createdAt === 'asc'
                ? left.createdAt.getTime() - right.createdAt.getTime()
                : right.createdAt.getTime() - left.createdAt.getTime(),
            );

          return matched.slice(0, take ?? matched.length);
        },
      ),
    },
  };

  beforeEach(async () => {
    adminUsers = [
      {
        id: 'admin-1',
        username: 'operator',
        passwordHash: 'unused',
        role: AdminUserRole.OPERATOR,
        status: AdminUserStatus.ACTIVE,
        createdAt: new Date('2026-03-31T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
      },
    ];
    users = [
      {
        id: 'user-1',
        openid: 'openid-1',
        unionid: null,
        nickname: '糯米和团子',
        avatarUrl: null,
        phone: '13800000001',
        phoneAuthorized: true,
        profileAuthorized: true,
        cityDefault: '西安',
        status: UserStatus.ACTIVE,
        createdAt: new Date('2026-03-29T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
      },
      {
        id: 'user-2',
        openid: 'openid-2',
        unionid: null,
        nickname: '雪球妈妈',
        avatarUrl: null,
        phone: '13800000002',
        phoneAuthorized: false,
        profileAuthorized: true,
        cityDefault: '西安',
        status: UserStatus.ACTIVE,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
      },
    ];
    posts = [
      {
        id: 'post-1',
        type: PostType.SERVICE,
        serviceCategory: null,
        title: '上门喂养服务',
        content: '工作日晚间可约',
        city: '西安',
        status: PostStatus.APPROVED,
        authorId: 'user-1',
        createdAt: new Date('2026-03-31T09:00:00.000Z'),
        updatedAt: new Date('2026-03-31T09:00:00.000Z'),
      },
      {
        id: 'post-2',
        type: PostType.PET_SOCIAL,
        serviceCategory: null,
        title: '晒猫日常',
        content: '春天第一次出门',
        city: '西安',
        status: PostStatus.PENDING,
        authorId: 'user-1',
        createdAt: new Date('2026-03-31T10:00:00.000Z'),
        updatedAt: new Date('2026-03-31T10:00:00.000Z'),
      },
      {
        id: 'post-3',
        type: PostType.PET_SOCIAL,
        serviceCategory: null,
        title: '救助记录',
        content: '等待领养',
        city: '西安',
        status: PostStatus.REJECTED,
        authorId: 'user-2',
        createdAt: new Date('2026-03-30T10:00:00.000Z'),
        updatedAt: new Date('2026-03-30T10:00:00.000Z'),
      },
    ];

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    applyGlobalAppSetup(app);
    await app.init();

    adminTokenService = app.get(AdminTokenService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('lists admin users with keyword filtering and post counts', async () => {
    const token = adminTokenService.sign('admin-1');

    await request(app.getHttpServer())
      .post('/api/admin/users?page=1&pageSize=10&keyword=糯米')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          items: [
            {
              id: 'user-1',
              nickname: '糯米和团子',
              phone: '13800000001',
              phoneAuthorized: true,
              profileAuthorized: true,
              createdAt: '2026-03-29T00:00:00.000Z',
              postCount: 2,
            },
          ],
          page: 1,
          pageSize: 10,
          total: 1,
          hasMore: false,
        });
      });
  });

  it('returns admin user detail with recent posts', async () => {
    const token = adminTokenService.sign('admin-1');

    await request(app.getHttpServer())
      .post('/api/admin/users/user-1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          id: 'user-1',
          nickname: '糯米和团子',
          avatarUrl: null,
          phone: '13800000001',
          phoneAuthorized: true,
          profileAuthorized: true,
          cityDefault: '西安',
          status: UserStatus.ACTIVE,
          createdAt: '2026-03-29T00:00:00.000Z',
          postCount: 2,
          recentPosts: [
            {
              id: 'post-2',
              title: '晒猫日常',
              type: PostType.PET_SOCIAL,
              status: PostStatus.PENDING,
              createdAt: '2026-03-31T10:00:00.000Z',
            },
            {
              id: 'post-1',
              title: '上门喂养服务',
              type: PostType.SERVICE,
              status: PostStatus.APPROVED,
              createdAt: '2026-03-31T09:00:00.000Z',
            },
          ],
        });
      });
  });
});
