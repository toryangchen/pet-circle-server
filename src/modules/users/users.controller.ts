import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ok } from '../../common/response/api-response';
import { CurrentAdminUser } from '../auth/current-admin-user.decorator';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { CurrentMiniappUser } from '../auth/current-miniapp-user.decorator';
import { MiniappAuthGuard } from '../auth/miniapp-auth.guard';
import type { AuthenticatedAdminUser } from '../auth/auth.types';
import type { AuthenticatedMiniappUser } from '../auth/auth.types';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('users/me/profile')
  @UseGuards(MiniappAuthGuard)
  @HttpCode(200)
  async updateMyProfile(
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Body() dto: UpdateMyProfileDto,
  ) {
    return ok(await this.usersService.updateMyProfile(user.id, dto));
  }

  @Post('admin/users')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  async listAdminUsers(
    @CurrentAdminUser() _adminUser: AuthenticatedAdminUser,
    @Query() dto: AdminUsersQueryDto,
  ) {
    return ok(await this.usersService.listAdminUsers(dto));
  }

  @Post('admin/users/:id')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  async getAdminUserDetail(
    @CurrentAdminUser() _adminUser: AuthenticatedAdminUser,
    @Param('id') userId: string,
  ) {
    return ok(await this.usersService.getAdminUserDetail(userId));
  }
}
