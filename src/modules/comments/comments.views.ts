import { Prisma, type User } from '@prisma/client';

export const commentInclude = {
  user: true,
} satisfies Prisma.CommentInclude;

export type HydratedComment = Prisma.CommentGetPayload<{
  include: typeof commentInclude;
}>;

type CommentTreeNode = {
  id: string;
  content: string;
  author: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
  createdAt: Date;
  replies: Array<{
    id: string;
    content: string;
    author: {
      id: string;
      nickname: string | null;
      avatarUrl: string | null;
    };
    createdAt: Date;
  }>;
};

function toAuthor(user: Pick<User, 'id' | 'nickname' | 'avatarUrl'>) {
  return {
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
  };
}

export function toCommentTree(comments: HydratedComment[]) {
  const roots = new Map<string, CommentTreeNode>();

  for (const comment of comments) {
    if (comment.status !== 'NORMAL') {
      continue;
    }

    if (!comment.parentId) {
      roots.set(comment.id, {
        id: comment.id,
        content: comment.content,
        author: toAuthor(comment.user),
        createdAt: comment.createdAt,
        replies: [],
      });
    }
  }

  for (const comment of comments) {
    if (comment.status !== 'NORMAL' || !comment.parentId || !comment.rootId) {
      continue;
    }

    const root = roots.get(comment.rootId);
    if (!root) {
      continue;
    }

    root.replies.push({
      id: comment.id,
      content: comment.content,
      author: toAuthor(comment.user),
      createdAt: comment.createdAt,
    });
  }

  return {
    items: Array.from(roots.values()),
  };
}
