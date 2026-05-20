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
import { FavoritesQueryDto } from './dto/favorites-query.dto';
import { FavoritesService } from './favorites.service';

@Controller()
@UseGuards(MiniappAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post('posts/:id/favorite')
  @HttpCode(200)
  async favoritePost(
    @Param('id') postId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
  ) {
    return ok(await this.favoritesService.favoritePost(postId, user));
  }

  @Post('posts/:id/favorite/delete')
  @HttpCode(200)
  async unfavoritePost(
    @Param('id') postId: string,
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
  ) {
    return ok(await this.favoritesService.unfavoritePost(postId, user));
  }

  @Post('favorites/my')
  @HttpCode(200)
  async listMyFavorites(
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Query() dto: FavoritesQueryDto,
  ) {
    return ok(await this.favoritesService.listMyFavorites(user.id, dto));
  }
}
