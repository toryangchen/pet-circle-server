import { Test, TestingModule } from '@nestjs/testing';
import { ConversationStatus, PostStatus, PostType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConversationsService } from './conversations.service';

describe('ConversationsService', () => {
  let service: ConversationsService;

  const prismaService = {
    post: {
      findUnique: jest.fn(),
    },
    conversation: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    conversationMessage: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const notificationsService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    prismaService.post.findUnique.mockReset();
    prismaService.conversation.findUnique.mockReset();
    prismaService.conversation.create.mockReset();
    prismaService.conversationMessage.create.mockReset();
    prismaService.$transaction.mockReset();
    notificationsService.createNotification.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  it('returns the existing conversation when a concurrent unique-key race happens', async () => {
    prismaService.post.findUnique.mockResolvedValue({
      id: 'post-1',
      type: PostType.SERVICE,
      status: PostStatus.APPROVED,
      authorId: 'author-1',
      title: '上门喂养',
    });
    prismaService.conversation.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'conversation-existing',
        status: ConversationStatus.PENDING,
      });
    prismaService.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique conflict', {
        code: 'P2002',
        clientVersion: '6.19.2',
      }),
    );

    await expect(
      service.requestContact('post-1', {
        id: 'initiator-1',
        phoneAuthorized: true,
      } as never),
    ).resolves.toEqual({
      conversationId: 'conversation-existing',
      status: ConversationStatus.PENDING,
      created: false,
    });
  });
});
