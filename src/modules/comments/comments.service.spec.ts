import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CommentStatus,
  NotificationType,
  PostStatus,
} from '@prisma/client';
import { CommentLevelExceededException } from '../../common/exceptions/comment-level-exceeded.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;

  const prismaService = {
    $transaction: jest.fn(),
    post: {
      findUnique: jest.fn(),
    },
    comment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const notificationsService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    prismaService.$transaction.mockReset();
    prismaService.post.findUnique.mockReset();
    prismaService.comment.findMany.mockReset();
    prismaService.comment.findUnique.mockReset();
    prismaService.comment.create.mockReset();
    prismaService.comment.updateMany.mockReset();
    notificationsService.createNotification.mockReset();
    prismaService.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaService) => Promise<unknown>) =>
        callback(prismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
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

    service = module.get<CommentsService>(CommentsService);
  });

  it('lists approved post comments as a root-and-reply tree', async () => {
    prismaService.post.findUnique.mockResolvedValue({
      id: 'post-1',
      status: PostStatus.APPROVED,
    });
    prismaService.comment.findMany.mockResolvedValue([
      {
        id: 'comment-root',
        postId: 'post-1',
        userId: 'user-root',
        parentId: null,
        rootId: null,
        content: '根评论',
        status: CommentStatus.NORMAL,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        user: {
          id: 'user-root',
          nickname: '发帖人',
          avatarUrl: 'https://example.com/root.png',
        },
      },
      {
        id: 'comment-reply',
        postId: 'post-1',
        userId: 'user-reply',
        parentId: 'comment-root',
        rootId: 'comment-root',
        content: '回复内容',
        status: CommentStatus.NORMAL,
        createdAt: new Date('2026-04-01T00:05:00.000Z'),
        user: {
          id: 'user-reply',
          nickname: '回复者',
          avatarUrl: null,
        },
      },
    ]);

    await expect(service.listComments('post-1')).resolves.toEqual({
      items: [
        {
          id: 'comment-root',
          content: '根评论',
          author: {
            id: 'user-root',
            nickname: '发帖人',
            avatarUrl: 'https://example.com/root.png',
          },
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          replies: [
            {
              id: 'comment-reply',
              content: '回复内容',
              author: {
                id: 'user-reply',
                nickname: '回复者',
                avatarUrl: null,
              },
              createdAt: new Date('2026-04-01T00:05:00.000Z'),
            },
          ],
        },
      ],
    });
  });

  it('rejects listing comments for non-approved posts', async () => {
    prismaService.post.findUnique.mockResolvedValue({
      id: 'post-1',
      status: PostStatus.PENDING,
    });

    await expect(service.listComments('post-1')).rejects.toThrow(
      new NotFoundException('Post not found.'),
    );

    expect(prismaService.comment.findMany).not.toHaveBeenCalled();
  });

  it('creates a root comment and notifies the post author', async () => {
    prismaService.post.findUnique.mockResolvedValue({
      id: 'post-1',
      status: PostStatus.APPROVED,
      authorId: 'author-1',
    });
    prismaService.comment.create.mockResolvedValue({
      id: 'comment-1',
    });

    await expect(
      service.createComment(
        'post-1',
        {
          id: 'user-commenter',
        } as never,
        { content: '想了解一下' },
      ),
    ).resolves.toEqual({
      id: 'comment-1',
    });

    expect(prismaService.comment.create).toHaveBeenCalledWith({
      data: {
        postId: 'post-1',
        userId: 'user-commenter',
        parentId: null,
        rootId: null,
        content: '想了解一下',
        status: CommentStatus.NORMAL,
      },
    });
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      prismaService,
      {
        userId: 'author-1',
        actorId: 'user-commenter',
        type: NotificationType.COMMENT_POST,
        postId: 'post-1',
        commentId: 'comment-1',
        conversationId: null,
      },
    );
  });

  it('skips self notifications when the post author comments on their own post', async () => {
    prismaService.post.findUnique.mockResolvedValue({
      id: 'post-1',
      status: PostStatus.APPROVED,
      authorId: 'author-1',
    });
    prismaService.comment.create.mockResolvedValue({
      id: 'comment-1',
    });

    await service.createComment(
      'post-1',
      {
        id: 'author-1',
      } as never,
      { content: '自己补充说明' },
    );

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it('creates a reply for a first-level comment and notifies the parent author', async () => {
    prismaService.comment.findUnique.mockResolvedValue({
      id: 'comment-root',
      postId: 'post-1',
      userId: 'parent-author',
      parentId: null,
      rootId: null,
      status: CommentStatus.NORMAL,
      content: '根评论',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      user: {
        id: 'parent-author',
        nickname: '原评论人',
        avatarUrl: null,
      },
    });
    prismaService.post.findUnique.mockResolvedValue({
      id: 'post-1',
      status: PostStatus.APPROVED,
      authorId: 'post-author',
    });
    prismaService.comment.create.mockResolvedValue({
      id: 'comment-reply',
    });

    await expect(
      service.replyComment(
        'comment-root',
        {
          id: 'reply-user',
        } as never,
        { content: '这是回复' },
      ),
    ).resolves.toEqual({
      id: 'comment-reply',
    });

    expect(prismaService.comment.create).toHaveBeenCalledWith({
      data: {
        postId: 'post-1',
        userId: 'reply-user',
        parentId: 'comment-root',
        rootId: 'comment-root',
        content: '这是回复',
        status: CommentStatus.NORMAL,
      },
    });
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      prismaService,
      {
        userId: 'parent-author',
        actorId: 'reply-user',
        type: NotificationType.REPLY_COMMENT,
        postId: 'post-1',
        commentId: 'comment-reply',
        conversationId: null,
      },
    );
  });

  it('rejects replying to a second-level comment', async () => {
    prismaService.comment.findUnique.mockResolvedValue({
      id: 'comment-reply',
      postId: 'post-1',
      userId: 'reply-author',
      parentId: 'comment-root',
      rootId: 'comment-root',
      status: CommentStatus.NORMAL,
      content: '二级评论',
      createdAt: new Date('2026-04-01T00:05:00.000Z'),
      user: {
        id: 'reply-author',
        nickname: '二级评论人',
        avatarUrl: null,
      },
    });

    await expect(
      service.replyComment(
        'comment-reply',
        {
          id: 'user-1',
        } as never,
        { content: '继续回复' },
      ),
    ).rejects.toThrow(new CommentLevelExceededException());

    expect(prismaService.post.findUnique).not.toHaveBeenCalled();
    expect(prismaService.comment.create).not.toHaveBeenCalled();
  });

  it('allows only the author to delete a normal comment', async () => {
    prismaService.comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      userId: 'comment-author',
      status: CommentStatus.NORMAL,
    });
    prismaService.comment.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.deleteComment('comment-1', 'comment-author'),
    ).resolves.toEqual({
      id: 'comment-1',
      status: CommentStatus.DELETED,
    });

    expect(prismaService.comment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'comment-1',
        userId: 'comment-author',
        status: CommentStatus.NORMAL,
      },
      data: {
        status: CommentStatus.DELETED,
      },
    });
  });

  it('rejects deleting someone else’s comment', async () => {
    prismaService.comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      userId: 'comment-author',
      status: CommentStatus.NORMAL,
    });

    await expect(service.deleteComment('comment-1', 'other-user')).rejects.toThrow(
      new ForbiddenException('Only the comment author can delete it.'),
    );

    expect(prismaService.comment.updateMany).not.toHaveBeenCalled();
  });

  it('returns deleted status idempotently for already deleted comments', async () => {
    prismaService.comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      userId: 'comment-author',
      status: CommentStatus.DELETED,
    });

    await expect(
      service.deleteComment('comment-1', 'comment-author'),
    ).resolves.toEqual({
      id: 'comment-1',
      status: CommentStatus.DELETED,
    });

    expect(prismaService.comment.updateMany).not.toHaveBeenCalled();
  });
});
