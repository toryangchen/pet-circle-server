import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedMiniappUser } from './auth.types';

type MiniappRequest = Request & {
  miniappUser?: AuthenticatedMiniappUser;
};

export const CurrentMiniappUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedMiniappUser => {
    const request = context.switchToHttp().getRequest<MiniappRequest>();

    return request.miniappUser as AuthenticatedMiniappUser;
  },
);
