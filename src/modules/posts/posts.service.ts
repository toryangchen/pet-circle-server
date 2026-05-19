import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PostStatus,
  PostType,
  ServiceCategory,
  type User,
} from '@prisma/client';
import { PhoneAuthorizationRequiredException } from '../../common/exceptions/phone-authorization-required.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { MyPostsQueryDto } from './dto/my-posts-query.dto';
import {
  postInclude,
  toAdminReviewDetail,
  toFeedItem,
  toMyPostItem,
  toPagedResult,
  toPostDetail,
  type HydratedPost,
} from './post-views';

type DetailFieldName =
  | 'adoptionDetail'
  | 'otherDetail'
  | 'secondHandDetail'
  | 'homeFeedingDetail'
  | 'boardingDetail';

const detailFieldByCategory: Record<ServiceCategory, DetailFieldName> = {
  [ServiceCategory.ADOPTION]: 'adoptionDetail',
  [ServiceCategory.OTHER]: 'otherDetail',
  [ServiceCategory.SECOND_HAND]: 'secondHandDetail',
  [ServiceCategory.HOME_FEEDING]: 'homeFeedingDetail',
  [ServiceCategory.BOARDING]: 'boardingDetail',
};

@Injectable()
export class PostsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getFeed(dto: FeedQueryDto, viewer?: User | null) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const where = {
      status: PostStatus.APPROVED,
      type: dto.channel,
      ...(dto.channel === PostType.SERVICE && dto.serviceCategory
        ? { serviceCategory: dto.serviceCategory }
        : {}),
      ...(dto.city ? { city: dto.city } : {}),
    };

    const [posts, total] = await Promise.all([
      this.prismaService.post.findMany({
        where,
        include: postInclude,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prismaService.post.count({ where }),
    ]);

    const favoritedPostIds = viewer?.id
      ? await this.getFavoritedPostIds(
          posts.map((post) => post.id),
          viewer.id,
        )
      : new Set<string>();

    return toPagedResult(
      posts.map((post) =>
        toFeedItem(post, {
          favorited: favoritedPostIds.has(post.id),
        }),
      ),
      page,
      pageSize,
      total,
    );
  }

  async getDetail(postId: string, viewer?: User | null) {
    const post = await this.findPostOrThrow(postId);

    if (post.status !== PostStatus.APPROVED && viewer?.id !== post.authorId) {
      throw new NotFoundException('Post not found.');
    }

    const viewerState =
      viewer?.id === undefined
        ? { liked: false, favorited: false }
        : await this.getViewerState(postId, viewer.id);

    return toPostDetail(post, viewer, viewerState);
  }

  async createPost(author: User, dto: CreatePostDto) {
    if (!author.phoneAuthorized) {
      throw new PhoneAuthorizationRequiredException();
    }

    const detailField = this.validateCreatePayload(dto);

    const created = await this.prismaService.$transaction(async (tx) => {
        const post = await tx.post.create({
          data: {
            type: dto.type,
            serviceCategory:
              dto.type === PostType.SERVICE ? dto.serviceCategory ?? null : null,
            title: dto.title.trim(),
            content: dto.content.trim(),
            city: dto.city.trim(),
            status: PostStatus.APPROVED,
            publishedAt: new Date(),
            approvedAt: new Date(),
            authorId: author.id,
          },
        });

        await tx.postAsset.createMany({
          data: dto.images.map((url, index) => ({
            postId: post.id,
            url,
            sortOrder: index,
          })),
        });

        if (this.hasContactData(dto.contact)) {
          await tx.postContact.create({
            data: {
              postId: post.id,
              wechatId: dto.contact.wechatId ?? null,
              phone: dto.contact.phone ?? null,
              contactName: dto.contact.contactName ?? null,
            },
          });
        }

        if (detailField) {
          await this.createServiceDetail(tx, post.id, detailField, dto);
        }

        return post;
      });

    return {
      id: created.id,
      status: created.status,
    };
  }

  async getMyPosts(userId: string, dto: MyPostsQueryDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const where = {
      authorId: userId,
      ...(dto.status ? { status: dto.status } : {}),
    };

    const [posts, total] = await Promise.all([
      this.prismaService.post.findMany({
        where,
        include: postInclude,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prismaService.post.count({ where }),
    ]);

    return toPagedResult(posts.map(toMyPostItem), page, pageSize, total);
  }

  async offlinePost(postId: string, userId: string) {
    const post = await this.findPostOrThrow(postId);
    this.assertAuthor(post, userId);

    if (post.type !== PostType.SERVICE || post.status !== PostStatus.APPROVED) {
      throw new ConflictException('Only approved service posts can be offlined.');
    }

    const updatedCount = await this.prismaService.post.updateMany({
      where: {
        id: postId,
        authorId: userId,
        type: PostType.SERVICE,
        status: PostStatus.APPROVED,
      },
      data: {
        status: PostStatus.OFFLINE,
        offlineAt: new Date(),
      },
    });

    if (updatedCount.count !== 1) {
      throw new ConflictException('Post status does not allow offline action.');
    }

    return {
      id: postId,
      status: PostStatus.OFFLINE,
    };
  }

  async completePost(postId: string, userId: string) {
    const post = await this.findPostOrThrow(postId);
    this.assertAuthor(post, userId);

    if (post.type !== PostType.SERVICE || post.status !== PostStatus.APPROVED) {
      throw new ConflictException('Only approved service posts can be completed.');
    }

    const updatedCount = await this.prismaService.post.updateMany({
      where: {
        id: postId,
        authorId: userId,
        type: PostType.SERVICE,
        status: PostStatus.APPROVED,
      },
      data: {
        status: PostStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    if (updatedCount.count !== 1) {
      throw new ConflictException('Only approved service posts can be completed.');
    }

    return {
      id: postId,
      status: PostStatus.COMPLETED,
    };
  }

  async getAdminPostDetail(postId: string) {
    return toAdminReviewDetail(await this.findPostOrThrow(postId));
  }

  private async findPostOrThrow(postId: string): Promise<HydratedPost> {
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
      include: postInclude,
    });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    return post;
  }

  private assertAuthor(post: HydratedPost, userId: string) {
    if (post.authorId !== userId) {
      throw new ForbiddenException('Only the author can manage this post.');
    }
  }

  private async getViewerState(postId: string, userId: string) {
    const prisma = this.prismaService as PrismaService & {
      like?: {
        findUnique: (args: {
          where: { postId_userId: { postId: string; userId: string } };
        }) => Promise<unknown>;
      };
      favorite?: {
        findUnique: (args: {
          where: { postId_userId: { postId: string; userId: string } };
        }) => Promise<unknown>;
      };
    };

    const [like, favorite] = await Promise.all([
      prisma.like?.findUnique?.({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      }) ?? Promise.resolve(null),
      prisma.favorite?.findUnique?.({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      }) ?? Promise.resolve(null),
    ]);

    return {
      liked: !!like,
      favorited: !!favorite,
    };
  }

  private async getFavoritedPostIds(postIds: string[], userId: string) {
    if (postIds.length === 0) {
      return new Set<string>();
    }

    const prisma = this.prismaService as PrismaService & {
      favorite?: {
        findMany: (args: {
          where: { userId: string; postId: { in: string[] } };
          select: { postId: true };
        }) => Promise<Array<{ postId: string }>>;
      };
    };

    const favorites =
      (await prisma.favorite?.findMany?.({
        where: {
          userId,
          postId: {
            in: postIds,
          },
        },
        select: {
          postId: true,
        },
      })) ?? [];

    return new Set(favorites.map((favorite) => favorite.postId));
  }

  private validateCreatePayload(dto: CreatePostDto): DetailFieldName | null {
    const detailEntries = (
      [
        ['adoptionDetail', dto.adoptionDetail],
        ['otherDetail', dto.otherDetail],
        ['secondHandDetail', dto.secondHandDetail],
        ['homeFeedingDetail', dto.homeFeedingDetail],
        ['boardingDetail', dto.boardingDetail],
      ] as const
    ).filter(([, value]) => value !== undefined);

    if (dto.type === PostType.PET_SOCIAL) {
      if (dto.serviceCategory || dto.contact || detailEntries.length > 0) {
        throw new BadRequestException(
          'Pet social posts cannot include service category, contact, or service detail.',
        );
      }

      return null;
    }

    if (!dto.serviceCategory) {
      throw new BadRequestException('Service posts require a service category.');
    }

    const expectedDetailField = detailFieldByCategory[dto.serviceCategory];

    if (
      detailEntries.length !== 1 ||
      detailEntries[0]?.[0] !== expectedDetailField
    ) {
      throw new BadRequestException(
        'Service category and detail payload must match exactly one detail block.',
      );
    }

    return expectedDetailField;
  }

  private async createServiceDetail(
    tx: Prisma.TransactionClient,
    postId: string,
    detailField: DetailFieldName,
    dto: CreatePostDto,
  ) {
    if (detailField === 'adoptionDetail' && dto.adoptionDetail) {
      await tx.adoptionDetail.create({
        data: {
          postId,
          ...dto.adoptionDetail,
        },
      });
      return;
    }

    if (detailField === 'secondHandDetail' && dto.secondHandDetail) {
      await tx.secondHandDetail.create({
        data: {
          postId,
          ...dto.secondHandDetail,
        },
      });
      return;
    }

    if (detailField === 'otherDetail' && dto.otherDetail) {
      await tx.otherDetail.create({
        data: {
          postId,
          ...dto.otherDetail,
        },
      });
      return;
    }

    if (detailField === 'homeFeedingDetail' && dto.homeFeedingDetail) {
      await tx.homeFeedingDetail.create({
        data: {
          postId,
          ...dto.homeFeedingDetail,
        },
      });
      return;
    }

    if (detailField === 'boardingDetail' && dto.boardingDetail) {
      await tx.boardingDetail.create({
        data: {
          postId,
          ...dto.boardingDetail,
        },
      });
    }
  }

  private hasContactData(
    dto: CreatePostDto['contact'],
  ): dto is NonNullable<CreatePostDto['contact']> {
    if (!dto) {
      return false;
    }

    return Boolean(dto.wechatId || dto.phone || dto.contactName);
  }
}
