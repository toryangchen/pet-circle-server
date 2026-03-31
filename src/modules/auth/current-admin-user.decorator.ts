import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedAdminUser } from './auth.types';

type AdminRequest = Request & {
  adminUser?: AuthenticatedAdminUser;
};

export const CurrentAdminUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedAdminUser => {
    const request = context.switchToHttp().getRequest<AdminRequest>();

    return request.adminUser as AuthenticatedAdminUser;
  },
);
