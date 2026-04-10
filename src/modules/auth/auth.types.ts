import { AdminUser, AdminUserRole, User } from '@prisma/client';

export type MiniappUserSummary = {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  bgType: string;
  phoneAuthorized: boolean;
  profileAuthorized: boolean;
  phoneMasked?: string;
};

export type MiniappLoginResult = {
  token: string;
  user: MiniappUserSummary;
};

export type AdminUserSummary = {
  id: string;
  username: string;
  role: AdminUserRole;
};

export type AdminLoginResult = {
  token: string;
  user: AdminUserSummary;
};

export type MiniappBindPhoneResult = {
  phoneAuthorized: boolean;
  phoneMasked: string;
};

export type AuthenticatedMiniappUser = User;
export type AuthenticatedAdminUser = AdminUser;
