import {
  Controller,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ok } from '../../common/response/api-response';
import { CurrentMiniappUser } from '../auth/current-miniapp-user.decorator';
import { MiniappAuthGuard } from '../auth/miniapp-auth.guard';
import type { AuthenticatedMiniappUser } from '../auth/auth.types';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(MiniappAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(200)
  async list(
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Query() dto: ListNotificationsQueryDto,
  ) {
    return ok(await this.notificationsService.listNotifications(user.id, dto));
  }

  @Post(':id/read')
  @HttpCode(200)
  async markRead(
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Param('id') notificationId: string,
  ) {
    return ok(
      await this.notificationsService.markRead(notificationId, user.id),
    );
  }

  @Post('read-all')
  @HttpCode(200)
  async markAllRead(@CurrentMiniappUser() user: AuthenticatedMiniappUser) {
    return ok(await this.notificationsService.markAllRead(user.id));
  }
}
