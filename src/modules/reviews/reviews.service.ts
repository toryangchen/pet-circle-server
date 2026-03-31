import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus, PrismaClient, ReviewAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import {
  postInclude,
  toAdminPostListItem,
  toAdminReviewDetail,
  toPagedResult,
  type HydratedPost,
} from '../posts/post-views';
import { AdminReviewQueryDto } from './dto/admin-review-query.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly postsService: PostsService,
  ) {}

  async getPendingReviews(dto: AdminReviewQueryDto) {
    return this.getAdminPostList({ ...dto, status: PostStatus.PENDING });
  }

  async getReviewDetail(postId: string) {
    return toAdminReviewDetail(await this.findPostOrThrow(postId));
  }

  async approve(postId: string, reviewerId: string) {
    const post = await this.findPostOrThrow(postId);
    this.assertPending(post);

    await this.prismaService.$transaction(async (tx: PrismaClient) => {
        const now = new Date();
        const updatedCount = await tx.post.updateMany({
          where: {
            id: postId,
            status: PostStatus.PENDING,
          },
          data: {
            status: PostStatus.APPROVED,
            approvedAt: now,
            publishedAt: now,
          },
        });

        if (updatedCount.count !== 1) {
          throw new ConflictException('Only pending posts can be reviewed.');
        }

        await tx.reviewLog.create({
          data: {
            postId,
            reviewerId,
            action: ReviewAction.APPROVE,
            reason: null,
          },
        });
      });

    return {
      id: postId,
      status: PostStatus.APPROVED,
    };
  }

  async reject(postId: string, reviewerId: string, reason: string) {
    const post = await this.findPostOrThrow(postId);
    this.assertPending(post);

    await this.prismaService.$transaction(async (tx: PrismaClient) => {
        const updatedCount = await tx.post.updateMany({
          where: {
            id: postId,
            status: PostStatus.PENDING,
          },
          data: {
            status: PostStatus.REJECTED,
            rejectedAt: new Date(),
          },
        });

        if (updatedCount.count !== 1) {
          throw new ConflictException('Only pending posts can be reviewed.');
        }

        await tx.reviewLog.create({
          data: {
            postId,
            reviewerId,
            action: ReviewAction.REJECT,
            reason,
          },
        });
      });

    return {
      id: postId,
      status: PostStatus.REJECTED,
    };
  }

  async offline(postId: string, reviewerId: string, reason?: string) {
    const post = await this.findPostOrThrow(postId);

    if (post.status !== PostStatus.APPROVED) {
      throw new ConflictException('Only approved posts can be offlined.');
    }

    await this.prismaService.$transaction(async (tx: PrismaClient) => {
        const updatedCount = await tx.post.updateMany({
          where: {
            id: postId,
            status: PostStatus.APPROVED,
          },
          data: {
            status: PostStatus.OFFLINE,
            offlineAt: new Date(),
          },
        });

        if (updatedCount.count !== 1) {
          throw new ConflictException('Only approved posts can be offlined.');
        }

        await tx.reviewLog.create({
          data: {
            postId,
            reviewerId,
            action: ReviewAction.OFFLINE,
            reason: reason ?? null,
          },
        });
      });

    return {
      id: postId,
      status: PostStatus.OFFLINE,
    };
  }

  async getOnlinePosts(dto: AdminReviewQueryDto) {
    return this.getAdminPostList({ ...dto, status: PostStatus.APPROVED });
  }

  private async getAdminPostList(
    dto: AdminReviewQueryDto & { status: PostStatus },
  ) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const where = {
      status: dto.status,
      ...(dto.type ? { type: dto.type } : {}),
      ...(dto.serviceCategory ? { serviceCategory: dto.serviceCategory } : {}),
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

    return toPagedResult(posts.map(toAdminPostListItem), page, pageSize, total);
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

  private assertPending(post: HydratedPost) {
    if (post.status !== PostStatus.PENDING) {
      throw new ConflictException('Only pending posts can be reviewed.');
    }
  }
}
