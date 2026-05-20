import {
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ok } from '../../common/response/api-response';
import { CurrentMiniappUser } from '../auth/current-miniapp-user.decorator';
import { MiniappAuthGuard } from '../auth/miniapp-auth.guard';
import type { AuthenticatedMiniappUser } from '../auth/auth.types';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
@UseGuards(MiniappAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post(':id')
  @HttpCode(200)
  async getConversation(
    @Param('id') conversationId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
  ) {
    return ok(await this.conversationsService.getConversation(conversationId, user.id));
  }

  @Post(':id/approve')
  @HttpCode(200)
  async approveConversation(
    @Param('id') conversationId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
  ) {
    return ok(
      await this.conversationsService.approveConversation(conversationId, user.id),
    );
  }
}
