import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { ok } from '../../common/response/api-response';
import { CurrentMiniappUser } from '../auth/current-miniapp-user.decorator';
import { MiniappAuthGuard } from '../auth/miniapp-auth.guard';
import type { AuthenticatedMiniappUser } from '../auth/auth.types';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me/profile')
  @UseGuards(MiniappAuthGuard)
  async updateMyProfile(
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Body() dto: UpdateMyProfileDto,
  ) {
    return ok(await this.usersService.updateMyProfile(user.id, dto));
  }
}
