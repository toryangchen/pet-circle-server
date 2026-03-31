import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminUserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedAdminUser } from './auth.types';
import { AdminTokenService } from './admin-token.service';

type AdminRequest = Request & {
  headers: {
    authorization?: string;
  };
  adminUser?: AuthenticatedAdminUser;
};

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly adminTokenService: AdminTokenService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Admin token is required.');
    }

    const token = authorization.slice('Bearer '.length).trim();
    const payload = this.adminTokenService.verify(token);
    const adminUser = await this.prismaService.adminUser.findUnique({
      where: { id: payload.sub },
    });

    if (!adminUser || adminUser.status !== AdminUserStatus.ACTIVE) {
      throw new UnauthorizedException('Admin user is unavailable.');
    }

    request.adminUser = adminUser;

    return true;
  }
}
