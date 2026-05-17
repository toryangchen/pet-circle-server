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
