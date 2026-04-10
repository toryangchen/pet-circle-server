import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminUser, AdminUserStatus, User, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminTokenService } from './admin-token.service';
import {
  AdminLoginResult,
  AdminUserSummary,
  MiniappBindPhoneResult,
  MiniappLoginResult,
  MiniappUserSummary,
} from './auth.types';
import { maskPhone } from './auth.utils';
import { MiniappTokenService } from './miniapp-token.service';
import { PasswordService } from './password.service';
import { WeChatAuthService } from './wechat-auth.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly weChatAuthService: WeChatAuthService,
    private readonly miniappTokenService: MiniappTokenService,
    private readonly adminTokenService: AdminTokenService,
    private readonly passwordService: PasswordService,
  ) {}

  async loginWithMiniappCode(code: string): Promise<MiniappLoginResult> {
    const weChatSession = await this.weChatAuthService.exchangeLoginCode(code);
    const user = await this.prismaService.user.upsert({
      where: { openid: weChatSession.openid },
      update: weChatSession.unionid
        ? {
            unionid: weChatSession.unionid,
          }
        : {},
      create: {
        openid: weChatSession.openid,
        unionid: weChatSession.unionid,
      },
    });

    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException('Miniapp user is disabled.');
    }

    return {
      token: this.miniappTokenService.sign(user.id),
      user: this.toMiniappUserSummary(user),
    };
  }

  async bindPhone(
    userId: string,
    code: string,
  ): Promise<MiniappBindPhoneResult> {
    const phoneInfo = await this.weChatAuthService.exchangePhoneCode(code);
    try {
      const user = await this.prismaService.$transaction(async (tx) => {
        const existingPhoneBinding = await tx.phoneBinding.findUnique({
          where: {
            phone: phoneInfo.phoneNumber,
          },
          select: {
            userId: true,
          },
        });

        if (existingPhoneBinding && existingPhoneBinding.userId !== userId) {
          throw new ConflictException(
            'Phone number is already bound to another user.',
          );
        }

        const legacyPhoneOwner = await tx.user.findFirst({
          where: {
            phone: phoneInfo.phoneNumber,
            NOT: {
              id: userId,
            },
          },
          select: {
            id: true,
          },
        });

        if (legacyPhoneOwner) {
          throw new ConflictException(
            'Phone number is already bound to another user.',
          );
        }

        await tx.phoneBinding.upsert({
          where: {
            userId,
          },
          update: {
            phone: phoneInfo.phoneNumber,
          },
          create: {
            userId,
            phone: phoneInfo.phoneNumber,
          },
        });

        return tx.user.update({
          where: { id: userId },
          data: {
            phone: phoneInfo.phoneNumber,
            phoneAuthorized: true,
          },
        });
      });

      return {
        phoneAuthorized: user.phoneAuthorized,
        phoneMasked: maskPhone(phoneInfo.phoneNumber),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Phone number is already bound to another user.',
        );
      }

      throw error;
    }
  }

  async loginAdmin(
    username: string,
    password: string,
  ): Promise<AdminLoginResult> {
    const adminUser = await this.prismaService.adminUser.findUnique({
      where: { username },
    });

    if (
      !adminUser ||
      !this.passwordService.verify(password, adminUser.passwordHash)
    ) {
      throw new UnauthorizedException(
        'Admin username or password is incorrect.',
      );
    }

    if (adminUser.status !== AdminUserStatus.ACTIVE) {
      throw new UnauthorizedException('Admin user is disabled.');
    }

    return {
      token: this.adminTokenService.sign(adminUser.id),
      user: this.toAdminUserSummary(adminUser),
    };
  }

  getCurrentMiniappUserSummary(user: User): MiniappUserSummary {
    return this.toMiniappUserSummary(user, true);
  }

  private toMiniappUserSummary(
    user: User,
    includeMaskedPhone = false,
  ): MiniappUserSummary {
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bgType: user.bgType ?? 'main-bg-01',
      phoneAuthorized: user.phoneAuthorized,
      profileAuthorized: user.profileAuthorized,
      phoneMasked:
        includeMaskedPhone && user.phoneAuthorized && user.phone
          ? maskPhone(user.phone)
          : undefined,
    };
  }

  private toAdminUserSummary(adminUser: AdminUser): AdminUserSummary {
    return {
      id: adminUser.id,
      username: adminUser.username,
      role: adminUser.role,
    };
  }
}
