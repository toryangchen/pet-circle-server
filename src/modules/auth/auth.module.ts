import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminTokenService } from './admin-token.service';
import { AdminAuthController, AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DefaultWeChatAuthService, WeChatAuthService } from './wechat-auth.service';
import { MiniappAuthGuard } from './miniapp-auth.guard';
import { MiniappTokenService } from './miniapp-token.service';
import { PasswordService } from './password.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController, AdminAuthController],
  providers: [
    AuthService,
    PasswordService,
    MiniappTokenService,
    AdminTokenService,
    MiniappAuthGuard,
    AdminAuthGuard,
    {
      provide: WeChatAuthService,
      useClass: DefaultWeChatAuthService,
    },
  ],
  exports: [
    AuthService,
    PasswordService,
    MiniappTokenService,
    AdminTokenService,
    MiniappAuthGuard,
    AdminAuthGuard,
    WeChatAuthService,
  ],
})
export class AuthModule {}
