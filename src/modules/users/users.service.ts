import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toPagedResult } from '../posts/post-views';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

type UserProfileSummary = {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  gender: string | null;
  birthday: string | null;
  region: {
    province: string | null;
    city: string | null;
    district: string | null;
  };
  profileAuthorized: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async updateMyProfile(
    userId: string,
    dto: UpdateMyProfileDto,
  ): Promise<UserProfileSummary> {
    const birthday =
      dto.birthday === undefined || dto.birthday === ''
        ? dto.birthday === '' ? null : undefined
        : new Date(`${dto.birthday}T00:00:00.000Z`);
    const user = await this.prismaService.user.update({
      where: { id: userId },
      data: {
        ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender || null } : {}),
        ...(birthday !== undefined ? { birthday } : {}),
        ...(dto.regionProvince !== undefined
          ? { regionProvince: dto.regionProvince || null }
          : {}),
        ...(dto.regionCity !== undefined ? { regionCity: dto.regionCity || null } : {}),
        ...(dto.regionDistrict !== undefined
          ? { regionDistrict: dto.regionDistrict || null }
          : {}),
        ...(dto.profileAuthorized !== undefined
          ? { profileAuthorized: dto.profileAuthorized }
          : {}),
      },
    });

    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      gender: user.gender ?? null,
      birthday: user.birthday ? user.birthday.toISOString().slice(0, 10) : null,
      region: {
        province: user.regionProvince ?? null,
        city: user.regionCity ?? user.cityDefault ?? null,
        district: user.regionDistrict ?? null,
      },
      profileAuthorized: user.profileAuthorized,
    };
  }

  async listAdminUsers(dto: AdminUsersQueryDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const keyword = dto.keyword?.trim();
    const where = keyword
      ? {
          OR: [
            {
              nickname: {
                contains: keyword,
              },
            },
            {
              phone: {
                contains: keyword,
              },
            },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prismaService.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prismaService.user.count({ where }),
    ]);

    const items = await Promise.all(
      users.map(async (user) => ({
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
        phoneAuthorized: user.phoneAuthorized,
        profileAuthorized: user.profileAuthorized,
        createdAt: user.createdAt,
        postCount: await this.prismaService.post.count({
          where: {
            authorId: user.id,
          },
        }),
      })),
    );

    return toPagedResult(items, page, pageSize, total);
  }

  async getAdminUserDetail(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const [postCount, recentPosts] = await Promise.all([
      this.prismaService.post.count({
        where: {
          authorId: user.id,
        },
      }),
      this.prismaService.post.findMany({
        where: {
          authorId: user.id,
        },
        take: 5,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      phoneAuthorized: user.phoneAuthorized,
      profileAuthorized: user.profileAuthorized,
      cityDefault: user.cityDefault,
      status: user.status,
      createdAt: user.createdAt,
      postCount,
      recentPosts: recentPosts.map((post) => ({
        id: post.id,
        title: post.title,
        type: post.type,
        status: post.status,
        createdAt: post.createdAt,
      })),
    };
  }
}
