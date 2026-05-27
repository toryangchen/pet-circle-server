import { Test, TestingModule } from '@nestjs/testing';
import { PostStatus, PostType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;

  const prismaService = {
    favorite: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    post: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    prismaService.favorite.findMany.mockReset();
    prismaService.favorite.findUnique.mockReset();
    prismaService.favorite.create.mockReset();
    prismaService.favorite.delete.mockReset();
    prismaService.post.findUnique.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get(FavoritesService);
  });

  it('marks cards from my favorites as favorited', async () => {
    prismaService.favorite.findMany.mockResolvedValue([
      {
        post: {
          id: 'post-fav-1',
          type: PostType.PET_SOCIAL,
          serviceCategory: null,
          title: '收藏的小狗',
          content: '我收藏过的内容。',
          city: '西安',
          status: PostStatus.APPROVED,
          assets: [{ url: 'https://example.test/favorite-dog.png' }],
          author: {
            nickname: '收藏作者',
            avatarUrl: null,
          },
          _count: {
            likes: 2,
            comments: 1,
            favorites: 1,
          },
          createdAt: new Date('2026-04-01T09:00:00.000Z'),
        },
      },
    ]);

    await expect(
      service.listMyFavorites('user-1', { page: 1, pageSize: 10 }),
    ).resolves.toMatchObject({
      items: [
        {
          id: 'post-fav-1',
          viewerState: {
            favorited: true,
          },
        },
      ],
    });
  });
});
