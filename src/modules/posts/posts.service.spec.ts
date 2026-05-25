import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommentStatus, PostStatus, PostType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { postInclude } from './post-views';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;

  const prismaService = {
    post: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    like: {
      findUnique: jest.fn(),
    },
    favorite: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    prismaService.post.findMany.mockReset();
    prismaService.post.count.mockReset();
    prismaService.post.findUnique.mockReset();
    prismaService.post.updateMany.mockReset();
    prismaService.like.findUnique.mockReset();
    prismaService.favorite.findUnique.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  it('counts only normal comments in post stats', () => {
    expect(postInclude._count.select.comments).toEqual({
      where: {
        status: CommentStatus.NORMAL,
      },
    });
  });

  it('returns card-ready fields for my posts', async () => {
    prismaService.post.findMany.mockResolvedValue([
      {
        id: 'post-1',
        authorId: 'user-1',
        type: PostType.PET_SOCIAL,
        serviceCategory: null,
        title: '猫咪第一次晒太阳',
        content: '今天在小区楼下晒了半小时太阳。',
        city: '西安',
        status: PostStatus.APPROVED,
        assets: [{ url: 'https://example.test/cat.png' }],
        author: {
          nickname: '团子家',
          avatarUrl: 'https://example.test/avatar.png',
        },
        reviewLogs: [],
        _count: {
          likes: 3,
          comments: 2,
          favorites: 1,
        },
        createdAt: new Date('2026-04-01T08:00:00.000Z'),
        updatedAt: new Date('2026-04-01T08:05:00.000Z'),
      },
    ]);
    prismaService.post.count.mockResolvedValue(1);

    await expect(
      service.getMyPosts('user-1', { page: 1, pageSize: 10 }),
    ).resolves.toMatchObject({
      items: [
        {
          id: 'post-1',
          title: '猫咪第一次晒太阳',
          summary: '今天在小区楼下晒了半小时太阳。',
          coverImage: 'https://example.test/cat.png',
          author: '团子家',
          authorAvatarUrl: 'https://example.test/avatar.png',
          stats: {
            likeCount: 3,
            commentCount: 2,
            favoriteCount: 1,
          },
          viewerState: {
            favorited: false,
          },
        },
      ],
      total: 1,
    });
  });

  it('allows authors to offline approved service posts', async () => {
    prismaService.post.findUnique.mockResolvedValue({
      id: 'post-1',
      authorId: 'user-1',
      type: PostType.SERVICE,
      status: PostStatus.APPROVED,
    });
    prismaService.post.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.offlinePost('post-1', 'user-1')).resolves.toEqual({
      id: 'post-1',
      status: PostStatus.OFFLINE,
    });

    expect(prismaService.post.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'post-1',
        authorId: 'user-1',
        type: PostType.SERVICE,
        status: PostStatus.APPROVED,
      },
      data: {
        status: PostStatus.OFFLINE,
        offlineAt: expect.any(Date),
      },
    });
  });

  it('rejects offline requests from non-authors', async () => {
    prismaService.post.findUnique.mockResolvedValue({
      id: 'post-1',
      authorId: 'user-author',
      type: PostType.SERVICE,
      status: PostStatus.APPROVED,
    });

    await expect(service.offlinePost('post-1', 'user-other')).rejects.toThrow(
      new ForbiddenException('Only the author can manage this post.'),
    );
  });

  it('rejects complete when the post is not an approved service post', async () => {
    prismaService.post.findUnique.mockResolvedValue({
      id: 'post-1',
      authorId: 'user-1',
      type: PostType.PET_SOCIAL,
      status: PostStatus.APPROVED,
    });

    await expect(service.completePost('post-1', 'user-1')).rejects.toThrow(
      new ConflictException('Only approved service posts can be completed.'),
    );

    expect(prismaService.post.updateMany).not.toHaveBeenCalled();
  });
});
