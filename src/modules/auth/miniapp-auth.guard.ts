import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedMiniappUser } from './auth.types';
import { MiniappTokenService } from './miniapp-token.service';

type MiniappRequest = Request & {
  headers: {
    authorization?: string;
  };
  miniappUser?: AuthenticatedMiniappUser;
};

@Injectable()
export class MiniappAuthGuard implements CanActivate {
  constructor(
    private readonly miniappTokenService: MiniappTokenService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MiniappRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Miniapp token is required.');
    }

    const token = authorization.slice('Bearer '.length).trim();
    const payload = this.miniappTokenService.verify(token);
    const user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Miniapp user is unavailable.');
    }

    request.miniappUser = user;

    return true;
  }
}
