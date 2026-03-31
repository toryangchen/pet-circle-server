import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AdminUserRole, AdminUserStatus, UserStatus } from '@prisma/client';
import { scryptSync } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminTokenService } from './admin-token.service';
import { AuthService } from './auth.service';
import { MiniappTokenService } from './miniapp-token.service';
import { PasswordService } from './password.service';
import { WeChatAuthService } from './wechat-auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  const prismaService = {
    adminUser: {
      findUnique: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };
  const weChatAuthService = {
    exchangeLoginCode: jest.fn(),
    exchangePhoneCode: jest.fn(),
  };

  beforeEach(async () => {
    prismaService.adminUser.findUnique.mockReset();
    prismaService.user.findFirst.mockReset();
    prismaService.user.upsert.mockReset();
    prismaService.user.update.mockReset();
    weChatAuthService.exchangeLoginCode.mockReset();
    weChatAuthService.exchangePhoneCode.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        MiniappTokenService,
        AdminTokenService,
        PasswordService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: WeChatAuthService,
          useValue: weChatAuthService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ADMIN_JWT_SECRET') {
                return undefined;
              }

              throw new Error(`Unexpected config key: ${key}`);
            }),
            getOrThrow: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') {
                return 'test-miniapp-secret';
              }

              throw new Error(`Unexpected config key: ${key}`);
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('creates a new user on first miniapp login and returns a token', async () => {
    weChatAuthService.exchangeLoginCode.mockResolvedValue({
      openid: 'openid-new-user',
    });
    prismaService.user.upsert.mockResolvedValue({
      id: 'user-new',
      openid: 'openid-new-user',
      unionid: null,
      nickname: null,
      avatarUrl: null,
      phone: null,
      phoneAuthorized: false,
      profileAuthorized: false,
      cityDefault: '西安',
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-03-31T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });

    const result = await authService.loginWithMiniappCode('miniapp-login-code');

    expect(weChatAuthService.exchangeLoginCode).toHaveBeenCalledWith(
      'miniapp-login-code',
    );
    expect(prismaService.user.upsert).toHaveBeenCalledWith({
      where: { openid: 'openid-new-user' },
      update: {},
      create: {
        openid: 'openid-new-user',
        unionid: undefined,
      },
    });
    expect(result).toEqual({
      token: expect.any(String),
      user: {
        id: 'user-new',
        nickname: null,
        avatarUrl: null,
        phoneAuthorized: false,
        profileAuthorized: false,
      },
    });
  });

  it('reuses the same user record for repeated or concurrent miniapp login attempts', async () => {
    weChatAuthService.exchangeLoginCode.mockResolvedValue({
      openid: 'openid-existing-user',
      unionid: 'union-existing-user',
    });
    prismaService.user.upsert.mockResolvedValue({
      id: 'user-existing',
      openid: 'openid-existing-user',
      unionid: 'union-existing-user',
      nickname: '已有用户',
      avatarUrl: 'https://example.com/avatar.png',
      phone: null,
      phoneAuthorized: false,
      profileAuthorized: true,
      cityDefault: '西安',
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });

    const result = await authService.loginWithMiniappCode('miniapp-login-code');

    expect(prismaService.user.upsert).toHaveBeenCalledWith({
      where: { openid: 'openid-existing-user' },
      update: {
        unionid: 'union-existing-user',
      },
      create: {
        openid: 'openid-existing-user',
        unionid: 'union-existing-user',
      },
    });
    expect(result).toEqual({
      token: expect.any(String),
      user: {
        id: 'user-existing',
        nickname: '已有用户',
        avatarUrl: 'https://example.com/avatar.png',
        phoneAuthorized: false,
        profileAuthorized: true,
      },
    });
  });

  it('rejects disabled miniapp users before issuing a new token', async () => {
    weChatAuthService.exchangeLoginCode.mockResolvedValue({
      openid: 'openid-disabled-user',
    });
    prismaService.user.upsert.mockResolvedValue({
      id: 'user-disabled',
      openid: 'openid-disabled-user',
      unionid: null,
      nickname: null,
      avatarUrl: null,
      phone: null,
      phoneAuthorized: false,
      profileAuthorized: false,
      cityDefault: '西安',
      status: UserStatus.DISABLED,
      createdAt: new Date('2026-03-31T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });

    await expect(
      authService.loginWithMiniappCode('miniapp-login-code'),
    ).rejects.toThrow(new UnauthorizedException('Miniapp user is disabled.'));
  });

  it('rejects binding a phone number that already belongs to another user', async () => {
    weChatAuthService.exchangePhoneCode.mockResolvedValue({
      phoneNumber: '13812345678',
    });
    prismaService.user.findFirst.mockResolvedValue({
      id: 'user-existing-phone-owner',
    });

    await expect(
      authService.bindPhone('user-current', 'wx-phone-code'),
    ).rejects.toThrow(
      new ConflictException('Phone number is already bound to another user.'),
    );

    expect(prismaService.user.findFirst).toHaveBeenCalledWith({
      where: {
        phone: '13812345678',
        NOT: {
          id: 'user-current',
        },
      },
      select: {
        id: true,
      },
    });
    expect(prismaService.user.update).not.toHaveBeenCalled();
  });

  it('returns an admin bearer token for an active admin with valid credentials', async () => {
    prismaService.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      username: 'operator',
      passwordHash: createPasswordHash('correct-password'),
      role: AdminUserRole.OPERATOR,
      status: AdminUserStatus.ACTIVE,
      createdAt: new Date('2026-03-31T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });

    const result = await authService.loginAdmin('operator', 'correct-password');

    expect(result).toEqual({
      token: expect.any(String),
      user: {
        id: 'admin-1',
        username: 'operator',
        role: AdminUserRole.OPERATOR,
      },
    });
  });

  it('rejects admin login when the password is invalid', async () => {
    prismaService.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      username: 'operator',
      passwordHash: createPasswordHash('correct-password'),
      role: AdminUserRole.OPERATOR,
      status: AdminUserStatus.ACTIVE,
      createdAt: new Date('2026-03-31T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });

    await expect(
      authService.loginAdmin('operator', 'wrong-password'),
    ).rejects.toThrow(
      new UnauthorizedException('Admin username or password is incorrect.'),
    );
  });
});

function createPasswordHash(password: string) {
  const salt = 'test-admin-salt';
  const derivedKey = scryptSync(password, salt, 64).toString('hex');

  return `scrypt$${salt}$${derivedKey}`;
}
