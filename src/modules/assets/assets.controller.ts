import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ok } from '../../common/response/api-response';
import { CurrentMiniappUser } from '../auth/current-miniapp-user.decorator';
import { MiniappAuthGuard } from '../auth/miniapp-auth.guard';
import type { AuthenticatedMiniappUser } from '../auth/auth.types';
import { CreateCosStsDto } from './dto/create-cos-sts.dto';
import { AssetsService } from './assets.service';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post('cos-sts')
  @HttpCode(200)
  @UseGuards(MiniappAuthGuard)
  async createCosSts(
    @CurrentMiniappUser() user: AuthenticatedMiniappUser,
    @Body() dto: CreateCosStsDto,
  ) {
    return ok(
      await this.assetsService.createCosUploadCredential(user.id, {
        kind: dto.kind,
        filename: dto.filename,
      }),
    );
  }
}
