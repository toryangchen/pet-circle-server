import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ok } from '../../common/response/api-response';
import { AuthService } from './auth.service';
import { CurrentMiniappUser } from './current-miniapp-user.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';
import { BindPhoneDto } from './dto/bind-phone.dto';
import { MiniappLoginDto } from './dto/miniapp-login.dto';
import { MiniappAuthGuard } from './miniapp-auth.guard';
import type { AuthenticatedMiniappUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('miniapp/login')
  @HttpCode(200)
  async login(@Body() dto: MiniappLoginDto) {
    return ok(await this.authService.loginWithMiniappCode(dto.code));
  }

  @Post('miniapp/bind-phone')
  @UseGuards(MiniappAuthGuard)
  @HttpCode(200)
  async bindPhone(
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Body() dto: BindPhoneDto,
  ) {
    return ok(await this.authService.bindPhone(user.id, dto.code));
  }

  @Get('me')
  @UseGuards(MiniappAuthGuard)
  async me(@CurrentMiniappUser() user: AuthenticatedMiniappUser) {
    return ok(this.authService.getCurrentMiniappUserSummary(user));
  }
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: AdminLoginDto) {
    return ok(await this.authService.loginAdmin(dto.username, dto.password));
  }
}
