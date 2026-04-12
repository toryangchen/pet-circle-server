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
    $transaction: jest.fn(),
    adminUser: {
      findUnique: jest.fn(),
    },
    phoneBinding: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
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
    prismaService.$transaction.mockReset();
    prismaService.adminUser.findUnique.mockReset();
    prismaService.phoneBinding.findUnique.mockReset();
    prismaService.phoneBinding.upsert.mockReset();
    prismaService.user.findFirst.mockReset();
    prismaService.user.upsert.mockReset();
    prismaService.user.update.mockReset();
    weChatAuthService.exchangeLoginCode.mockReset();
    weChatAuthService.exchangePhoneCode.mockReset();
    prismaService.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaService) => Promise<unknown>) =>
        callback(prismaService),
    );

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
      bgType: 'main-bg-01',
      gender: null,
      birthday: null,
      regionProvince: null,
      regionCity: null,
      regionDistrict: null,
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
        bgType: 'main-bg-01',
        gender: null,
        birthday: null,
        region: {
          province: null,
          city: '西安',
          district: null,
        },
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
      bgType: 'main-bg-01',
      gender: '女',
      birthday: new Date('2020-08-18T00:00:00.000Z'),
      regionProvince: '陕西省',
      regionCity: '西安市',
      regionDistrict: '雁塔区',
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
        bgType: 'main-bg-01',
        gender: '女',
        birthday: '2020-08-18',
        region: {
          province: '陕西省',
          city: '西安市',
          district: '雁塔区',
        },
        phoneAuthorized: false,
        profileAuthorized: true,
        phoneMasked: undefined,
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
      bgType: 'main-bg-01',
      gender: null,
      birthday: null,
      regionProvince: null,
      regionCity: null,
      regionDistrict: null,
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
    prismaService.phoneBinding.findUnique.mockResolvedValue({
      userId: 'user-existing-phone-owner',
    });

    await expect(
      authService.bindPhone('user-current', 'wx-phone-code'),
    ).rejects.toThrow(
      new ConflictException('Phone number is already bound to another user.'),
    );

    expect(prismaService.phoneBinding.findUnique).toHaveBeenCalledWith({
      where: {
        phone: '13812345678',
      },
      select: {
        userId: true,
      },
    });
    expect(prismaService.user.findFirst).not.toHaveBeenCalled();
    expect(prismaService.user.update).not.toHaveBeenCalled();
  });

  it('stores the phone binding and updates the miniapp user in one transaction', async () => {
    weChatAuthService.exchangePhoneCode.mockResolvedValue({
      phoneNumber: '13812345678',
    });
    prismaService.phoneBinding.findUnique.mockResolvedValue(null);
    prismaService.user.findFirst.mockResolvedValue(null);
    prismaService.phoneBinding.upsert.mockResolvedValue({
      id: 'binding-1',
      phone: '13812345678',
      userId: 'user-current',
    });
    prismaService.user.update.mockResolvedValue({
      id: 'user-current',
      openid: 'openid-current',
      unionid: null,
      nickname: null,
      avatarUrl: null,
      bgType: 'main-bg-01',
      gender: null,
      birthday: null,
      regionProvince: null,
      regionCity: null,
      regionDistrict: null,
      phone: '13812345678',
      phoneAuthorized: true,
      profileAuthorized: false,
      cityDefault: '西安',
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-03-31T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    });

    await expect(
      authService.bindPhone('user-current', 'wx-phone-code'),
    ).resolves.toEqual({
      phoneAuthorized: true,
      phoneMasked: '138****5678',
    });

    expect(prismaService.phoneBinding.upsert).toHaveBeenCalledWith({
      where: {
        userId: 'user-current',
      },
      update: {
        phone: '13812345678',
      },
      create: {
        userId: 'user-current',
        phone: '13812345678',
      },
    });
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
    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { id: 'user-current' },
      data: {
        phone: '13812345678',
        phoneAuthorized: true,
      },
    });
  });

  it('rejects binding a phone number that only exists in legacy user rows', async () => {
    weChatAuthService.exchangePhoneCode.mockResolvedValue({
      phoneNumber: '13812345678',
    });
    prismaService.phoneBinding.findUnique.mockResolvedValue(null);
    prismaService.user.findFirst.mockResolvedValue({
      id: 'legacy-phone-owner',
    });

    await expect(
      authService.bindPhone('user-current', 'wx-phone-code'),
    ).rejects.toThrow(
      new ConflictException('Phone number is already bound to another user.'),
    );

    expect(prismaService.phoneBinding.upsert).not.toHaveBeenCalled();
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
