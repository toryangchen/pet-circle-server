import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PostStatus, PostType, ReviewAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  let service: ReviewsService;

  const prismaService = {
    $transaction: jest.fn(),
    post: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    reviewLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    prismaService.$transaction.mockReset();
    prismaService.post.findUnique.mockReset();
    prismaService.post.updateMany.mockReset();
    prismaService.reviewLog.create.mockReset();
    prismaService.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaService) => Promise<unknown>) => callback(prismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: PostsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  it('approves a pending post and records a review log', async () => {
    prismaService.post.findUnique.mockResolvedValue({
      id: 'post-1',
      status: PostStatus.PENDING,
    });
    prismaService.post.updateMany.mockResolvedValue({ count: 1 });
    prismaService.reviewLog.create.mockResolvedValue({ id: 'log-1' });

    await expect(service.approve('post-1', 'admin-1')).resolves.toEqual({
      id: 'post-1',
      status: PostStatus.APPROVED,
    });

    expect(prismaService.post.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'post-1',
        status: PostStatus.PENDING,
      },
      data: expect.objectContaining({
        status: PostStatus.APPROVED,
        approvedAt: expect.any(Date),
        publishedAt: expect.any(Date),
      }),
    });
    expect(prismaService.reviewLog.create).toHaveBeenCalledWith({
      data: {
        postId: 'post-1',
        reviewerId: 'admin-1',
        action: ReviewAction.APPROVE,
        reason: null,
      },
    });
  });

  it('rejects non-pending posts before writing review changes', async () => {
    prismaService.post.findUnique.mockResolvedValue({
      id: 'post-1',
      status: PostStatus.APPROVED,
    });

    await expect(service.reject('post-1', 'admin-1', '不符合规范')).rejects.toThrow(
      new ConflictException('Only pending posts can be reviewed.'),
    );

    expect(prismaService.post.updateMany).not.toHaveBeenCalled();
    expect(prismaService.reviewLog.create).not.toHaveBeenCalled();
  });

  it('offlines approved posts and records the offline reason', async () => {
    prismaService.post.findUnique.mockResolvedValue({
      id: 'post-1',
      status: PostStatus.APPROVED,
    });
    prismaService.post.updateMany.mockResolvedValue({ count: 1 });
    prismaService.reviewLog.create.mockResolvedValue({ id: 'log-1' });

    await expect(service.offline('post-1', 'admin-1', '内容过期')).resolves.toEqual({
      id: 'post-1',
      status: PostStatus.OFFLINE,
    });

    expect(prismaService.reviewLog.create).toHaveBeenCalledWith({
      data: {
        postId: 'post-1',
        reviewerId: 'admin-1',
        action: ReviewAction.OFFLINE,
        reason: '内容过期',
      },
    });
  });

  it('throws when the target post does not exist', async () => {
    prismaService.post.findUnique.mockResolvedValue(null);

    await expect(service.getReviewDetail('missing-post')).rejects.toThrow(
      new NotFoundException('Post not found.'),
    );
  });
});
