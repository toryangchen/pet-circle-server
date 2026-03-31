import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

type UserProfileSummary = {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  profileAuthorized: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async updateMyProfile(
    userId: string,
    dto: UpdateMyProfileDto,
  ): Promise<UserProfileSummary> {
    const user = await this.prismaService.user.update({
      where: { id: userId },
      data: {
        ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.profileAuthorized !== undefined
          ? { profileAuthorized: dto.profileAuthorized }
          : {}),
      },
    });

    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      profileAuthorized: user.profileAuthorized,
    };
  }
}
