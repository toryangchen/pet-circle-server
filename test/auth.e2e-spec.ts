import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminUserRole, AdminUserStatus, UserStatus } from '@prisma/client';
import { createHmac, scryptSync } from 'crypto';
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
import { PrismaService } from '../src/prisma/prisma.service';
import { WeChatAuthService } from '../src/modules/auth/wechat-auth.service';

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

type TestPhoneBinding = {
  id: string;
  phone: string;
  userId: string;
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

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let users: TestUser[];
  let adminUsers: TestAdminUser[];
  let phoneBindings: TestPhoneBinding[];

  const weChatAuthService = {
    exchangeLoginCode: jest.fn(),
    exchangePhoneCode: jest.fn(),
  };

  const prismaService = {
    onModuleInit: jest.fn(),
    $transaction: jest.fn(async (callback: (tx: typeof prismaService) => Promise<unknown>) =>
      callback(prismaService),
    ),
    phoneBinding: {
      findUnique: jest.fn(
        async ({
          where,
          select,
        }: {
          where: { phone: string };
          select?: { userId?: boolean };
        }) => {
          const binding =
            phoneBindings.find((item) => item.phone === where.phone) ?? null;

          if (!binding) {
            return null;
          }

          if (select?.userId) {
            return {
              userId: binding.userId,
            };
          }

          return binding;
        },
      ),
      upsert: jest.fn(
        async ({
          where,
          update,
          create,
        }: {
          where: { userId: string };
          update: { phone: string };
          create: { userId: string; phone: string };
        }): Promise<TestPhoneBinding> => {
          const existingBinding =
            phoneBindings.find((item) => item.userId === where.userId) ?? null;

          if (existingBinding) {
            existingBinding.phone = update.phone;
            existingBinding.updatedAt = new Date('2026-03-31T01:00:00.000Z');
            return existingBinding;
          }

          const binding: TestPhoneBinding = {
            id: `phone-binding-${phoneBindings.length + 1}`,
            phone: create.phone,
            userId: create.userId,
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
            updatedAt: new Date('2026-03-31T00:00:00.000Z'),
          };
          phoneBindings.push(binding);
          return binding;
        },
      ),
    },
    user: {
      upsert: jest.fn(
        async ({
          where,
          update,
          create,
        }: {
          where: { openid: string };
          update: { unionid?: string };
          create: { openid: string; unionid?: string };
        }): Promise<TestUser> => {
          const existingUser =
            users.find((user) => user.openid === where.openid) ?? null;

          if (existingUser) {
            if (update.unionid !== undefined) {
              existingUser.unionid = update.unionid;
            }

            return existingUser;
          }

          const user: TestUser = {
            id: `user-${users.length + 1}`,
            openid: create.openid,
            unionid: create.unionid ?? null,
            nickname: null,
            avatarUrl: null,
            phone: null,
            phoneAuthorized: false,
            profileAuthorized: false,
            cityDefault: '西安',
            status: UserStatus.ACTIVE,
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
            updatedAt: new Date('2026-03-31T00:00:00.000Z'),
          };
          users.push(user);
          return user;
        },
      ),
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
      findFirst: jest.fn(
        async ({
          where,
          select,
        }: {
          where: {
            phone?: string;
            NOT?: { id?: string };
          };
          select?: { id?: boolean };
        }) => {
          const matchedUser =
            users.find(
              (user) =>
                user.phone === where.phone && user.id !== where.NOT?.id,
            ) ?? null;

          if (!matchedUser) {
            return null;
          }

          if (select?.id) {
            return { id: matchedUser.id };
          }

          return matchedUser;
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<
            Pick<
              TestUser,
              'phone' | 'phoneAuthorized' | 'nickname' | 'avatarUrl' | 'profileAuthorized'
            >
          >;
        }): Promise<TestUser> => {
          const user = users.find((candidate) => candidate.id === where.id);
          if (!user) {
            throw new Error(`User not found: ${where.id}`);
          }

          if (data.phone !== undefined) {
            user.phone = data.phone;
          }
          if (data.phoneAuthorized !== undefined) {
            user.phoneAuthorized = data.phoneAuthorized;
          }
          if (data.nickname !== undefined) {
            user.nickname = data.nickname;
          }
          if (data.avatarUrl !== undefined) {
            user.avatarUrl = data.avatarUrl;
          }
          if (data.profileAuthorized !== undefined) {
            user.profileAuthorized = data.profileAuthorized;
          }
          user.updatedAt = new Date('2026-03-31T01:00:00.000Z');

          return user;
        },
      ),
    },
    adminUser: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { username: string };
        }): Promise<TestAdminUser | null> =>
          adminUsers.find((user) => user.username === where.username) ?? null,
      ),
    },
  };

  beforeEach(async () => {
    users = [];
    adminUsers = [];
    phoneBindings = [];
    weChatAuthService.exchangeLoginCode.mockReset();
    weChatAuthService.exchangePhoneCode.mockReset();
    prismaService.$transaction.mockClear();
    prismaService.phoneBinding.findUnique.mockClear();
    prismaService.phoneBinding.upsert.mockClear();
    prismaService.user.upsert.mockClear();
    prismaService.user.findUnique.mockClear();
    prismaService.user.findFirst.mockClear();
    prismaService.user.update.mockClear();
    prismaService.adminUser.findUnique.mockClear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .overrideProvider(WeChatAuthService)
      .useValue(weChatAuthService)
      .compile();

    app = moduleFixture.createNestApplication();
    applyGlobalAppSetup(app);
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('registers a new user on login and returns a bearer token envelope', async () => {
    weChatAuthService.exchangeLoginCode.mockResolvedValue({
      openid: 'openid-login-new',
    });

    await request(app.getHttpServer())
      .post('/api/auth/miniapp/login')
      .send({ code: 'wx-login-code' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 0,
          message: 'ok',
          data: {
            token: expect.any(String),
            user: {
              id: 'user-1',
              nickname: null,
              avatarUrl: null,
              phoneAuthorized: false,
              profileAuthorized: false,
            },
          },
        });
      });
  });

  it('logs in an active admin user and returns an admin bearer token envelope', async () => {
    adminUsers.push({
      id: 'admin-1',
      username: 'operator',
      passwordHash: createPasswordHash('correct-password'),
      role: AdminUserRole.OPERATOR,
      status: AdminUserStatus.ACTIVE,
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });

    await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        username: 'operator',
        password: 'correct-password',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 0,
          message: 'ok',
          data: {
            token: expect.any(String),
            user: {
              id: 'admin-1',
              username: 'operator',
              role: AdminUserRole.OPERATOR,
            },
          },
        });
      });
  });

  it('rejects admin login when the password is incorrect', async () => {
    adminUsers.push({
      id: 'admin-1',
      username: 'operator',
      passwordHash: createPasswordHash('correct-password'),
      role: AdminUserRole.OPERATOR,
      status: AdminUserStatus.ACTIVE,
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });

    await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        username: 'operator',
        password: 'wrong-password',
      })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 40002,
          message: 'Admin username or password is incorrect.',
          data: null,
        });
      });
  });

  it('requires miniapp authentication before binding phone', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/miniapp/bind-phone')
      .send({ code: 'wx-phone-code' })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 40002,
          message: 'Miniapp token is required.',
          data: null,
        });
      });
  });

  it('returns validation errors with the api error envelope', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/miniapp/login')
      .send({})
      .expect(400)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 40001,
          message: expect.stringContaining('code should not be empty'),
          data: null,
        });
      });
  });

  it('rejects invalid or missing bearer tokens on current-user access with the api error envelope', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 40002,
          message: 'Miniapp token is required.',
          data: null,
        });
      });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${createMalformedSignedToken()}`)
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 40002,
          message: 'Invalid miniapp token.',
          data: null,
        });
      });
  });

  it('binds phone for the authenticated miniapp user and returns masked phone', async () => {
    weChatAuthService.exchangeLoginCode.mockResolvedValue({
      openid: 'openid-bind-phone',
    });
    weChatAuthService.exchangePhoneCode.mockResolvedValue({
      phoneNumber: '13812345678',
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/miniapp/login')
      .send({ code: 'wx-login-code' })
      .expect(200);

    const token = loginResponse.body.data.token;

    await request(app.getHttpServer())
      .post('/api/auth/miniapp/bind-phone')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'wx-phone-code' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 0,
          message: 'ok',
          data: {
            phoneAuthorized: true,
            phoneMasked: '138****5678',
          },
        });
      });
  });

  it('rejects binding a phone number that is already used by another user', async () => {
    users.push({
      id: 'user-phone-owner',
      openid: 'openid-phone-owner',
      unionid: null,
      nickname: '已有手机号用户',
      avatarUrl: null,
      phone: '13812345678',
      phoneAuthorized: true,
      profileAuthorized: false,
      cityDefault: '西安',
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });
    phoneBindings.push({
      id: 'phone-binding-1',
      phone: '13812345678',
      userId: 'user-phone-owner',
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });
    weChatAuthService.exchangeLoginCode.mockResolvedValue({
      openid: 'openid-bind-phone-current-user',
    });
    weChatAuthService.exchangePhoneCode.mockResolvedValue({
      phoneNumber: '13812345678',
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/miniapp/login')
      .send({ code: 'wx-login-code' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/miniapp/bind-phone')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
      .send({ code: 'wx-phone-code' })
      .expect(409)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 40005,
          message: 'Phone number is already bound to another user.',
          data: null,
        });
      });
  });

  it('persists a dedicated phone binding record when binding phone succeeds', async () => {
    weChatAuthService.exchangeLoginCode.mockResolvedValue({
      openid: 'openid-bind-phone-with-binding',
    });
    weChatAuthService.exchangePhoneCode.mockResolvedValue({
      phoneNumber: '13700001111',
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/miniapp/login')
      .send({ code: 'wx-login-code' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/miniapp/bind-phone')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
      .send({ code: 'wx-phone-code' })
      .expect(200);

    expect(phoneBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phone: '13700001111',
          userId: 'user-1',
        }),
      ]),
    );
  });

  it('still rejects binding when the conflicting phone only exists on a legacy user row', async () => {
    users.push({
      id: 'legacy-phone-owner',
      openid: 'openid-legacy-phone-owner',
      unionid: null,
      nickname: '旧手机号用户',
      avatarUrl: null,
      phone: '13700002222',
      phoneAuthorized: true,
      profileAuthorized: false,
      cityDefault: '西安',
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });
    weChatAuthService.exchangeLoginCode.mockResolvedValue({
      openid: 'openid-bind-phone-current-user-legacy-check',
    });
    weChatAuthService.exchangePhoneCode.mockResolvedValue({
      phoneNumber: '13700002222',
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/miniapp/login')
      .send({ code: 'wx-login-code' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/miniapp/bind-phone')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
      .send({ code: 'wx-phone-code' })
      .expect(409)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 40005,
          message: 'Phone number is already bound to another user.',
          data: null,
        });
      });
  });

  it('returns the authenticated miniapp user summary with masked phone when bound', async () => {
    users.push({
      id: 'user-me',
      openid: 'openid-me',
      unionid: null,
      nickname: '宠友圈用户',
      avatarUrl: 'https://example.com/avatar.png',
      phone: '13900001234',
      phoneAuthorized: true,
      profileAuthorized: true,
      cityDefault: '西安',
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });
    weChatAuthService.exchangeLoginCode.mockResolvedValue({
      openid: 'openid-me',
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/miniapp/login')
      .send({ code: 'wx-login-code' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 0,
          message: 'ok',
          data: {
            id: 'user-me',
            nickname: '宠友圈用户',
            avatarUrl: 'https://example.com/avatar.png',
            phoneAuthorized: true,
            profileAuthorized: true,
            phoneMasked: '139****1234',
          },
        });
      });
  });

  it('updates the current miniapp user profile and returns the updated summary', async () => {
    users.push({
      id: 'user-profile',
      openid: 'openid-profile',
      unionid: null,
      nickname: '旧昵称',
      avatarUrl: 'https://example.com/old-avatar.png',
      phone: null,
      phoneAuthorized: false,
      profileAuthorized: false,
      cityDefault: '西安',
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });
    weChatAuthService.exchangeLoginCode.mockResolvedValue({
      openid: 'openid-profile',
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/miniapp/login')
      .send({ code: 'wx-login-code' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/users/me/profile')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
      .send({
        nickname: '新昵称',
        avatarUrl: 'https://example.com/new-avatar.png',
        profileAuthorized: true,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 0,
          message: 'ok',
          data: {
            id: 'user-profile',
            nickname: '新昵称',
            avatarUrl: 'https://example.com/new-avatar.png',
            profileAuthorized: true,
          },
        });
      });

    expect(users[0]).toMatchObject({
      nickname: '新昵称',
      avatarUrl: 'https://example.com/new-avatar.png',
      profileAuthorized: true,
      phoneAuthorized: false,
    });
  });

  it('rejects attempts to update fields outside the allowed miniapp profile contract', async () => {
    users.push({
      id: 'user-profile-overpost',
      openid: 'openid-profile-overpost',
      unionid: null,
      nickname: '旧昵称',
      avatarUrl: 'https://example.com/old-avatar.png',
      phone: null,
      phoneAuthorized: false,
      profileAuthorized: false,
      cityDefault: '西安',
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });
    weChatAuthService.exchangeLoginCode.mockResolvedValue({
      openid: 'openid-profile-overpost',
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/miniapp/login')
      .send({ code: 'wx-login-code' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/users/me/profile')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
      .send({
        nickname: '新昵称',
        phoneAuthorized: true,
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 40001,
          message: expect.stringContaining(
            'property phoneAuthorized should not exist',
          ),
          data: null,
        });
      });
  });

  it('requires miniapp authentication before updating the current user profile', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/me/profile')
      .send({
        nickname: '未登录用户',
      })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 40002,
          message: 'Miniapp token is required.',
          data: null,
        });
      });
  });

  it('rejects disabled users during miniapp login before issuing a token', async () => {
    users.push({
      id: 'user-disabled',
      openid: 'openid-disabled',
      unionid: null,
      nickname: null,
      avatarUrl: null,
      phone: null,
      phoneAuthorized: false,
      profileAuthorized: false,
      cityDefault: '西安',
      status: UserStatus.DISABLED,
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });
    weChatAuthService.exchangeLoginCode.mockResolvedValue({
      openid: 'openid-disabled',
    });

    await request(app.getHttpServer())
      .post('/api/auth/miniapp/login')
      .send({ code: 'wx-login-code' })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 40002,
          message: 'Miniapp user is disabled.',
          data: null,
        });
      });
  });
});

function createMalformedSignedToken() {
  const encodedHeader = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    'utf8',
  ).toString('base64url');
  const encodedPayload = Buffer.from('not-json', 'utf8').toString('base64url');
  const signature = createHmac('sha256', 'test-miniapp-secret')
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function createPasswordHash(password: string) {
  const salt = 'test-admin-salt';
  const derivedKey = scryptSync(password, salt, 64).toString('hex');

  return `scrypt$${salt}$${derivedKey}`;
}
