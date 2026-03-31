import { Prisma, ReviewAction, type User } from '@prisma/client';

export const postInclude = {
  author: true,
  assets: {
    orderBy: {
      sortOrder: 'asc',
    },
  },
  contact: true,
  adoptionDetail: true,
  secondHandDetail: true,
  homeFeedingDetail: true,
  boardingDetail: true,
  reviewLogs: {
    orderBy: {
      createdAt: 'desc',
    },
  },
  _count: {
    select: {
      likes: true,
      comments: true,
      favorites: true,
    },
  },
} satisfies Prisma.PostInclude;

export type HydratedPost = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;

type ViewerLike = Pick<User, 'id' | 'phoneAuthorized'> | null | undefined;

function getStats(post: HydratedPost) {
  return {
    likeCount: post._count?.likes ?? 0,
    commentCount: post._count?.comments ?? 0,
    favoriteCount: post._count?.favorites ?? 0,
  };
}

function getImages(post: HydratedPost) {
  return post.assets.map((asset) => asset.url);
}

function getCoverImage(post: HydratedPost) {
  return post.assets[0]?.url ?? null;
}

function getRejectReason(post: HydratedPost) {
  return (
    post.reviewLogs.find((log) => log.action === ReviewAction.REJECT)?.reason ?? null
  );
}

export function toFeedItem(post: HydratedPost) {
  return {
    id: post.id,
    type: post.type,
    serviceCategory: post.serviceCategory,
    status: undefined,
    title: post.title,
    summary: post.content,
    coverImage: getCoverImage(post),
    city: post.city,
    stats: getStats(post),
    createdAt: post.createdAt,
  };
}

export function toPostDetail(post: HydratedPost, viewer?: ViewerLike) {
  const canViewContact =
    post.type === 'SERVICE' &&
    !!post.contact &&
    viewer?.id === post.authorId;

  return {
    id: post.id,
    type: post.type,
    serviceCategory: post.serviceCategory,
    status: post.status,
    title: post.title,
    content: post.content,
    city: post.city,
    images: getImages(post),
    adoptionDetail: post.adoptionDetail,
    secondHandDetail: post.secondHandDetail,
    homeFeedingDetail: post.homeFeedingDetail,
    boardingDetail: post.boardingDetail,
    author: post.author
      ? {
          id: post.author.id,
          nickname: post.author.nickname,
          avatarUrl: post.author.avatarUrl,
        }
      : null,
    contact:
      post.type === 'SERVICE'
        ? {
            visible: canViewContact,
            ...(canViewContact && post.contact
              ? {
                  wechatId: post.contact.wechatId,
                  phone: post.contact.phone,
                  contactName: post.contact.contactName,
                }
              : {}),
          }
        : undefined,
    stats: getStats(post),
    viewerState: {
      liked: false,
      favorited: false,
      phoneAuthorized: !!viewer?.phoneAuthorized,
    },
    createdAt: post.createdAt,
  };
}

export function toMyPostItem(post: HydratedPost) {
  return {
    id: post.id,
    type: post.type,
    serviceCategory: post.serviceCategory,
    title: post.title,
    city: post.city,
    status: post.status,
    rejectReason: getRejectReason(post),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

export function toAdminPostListItem(post: HydratedPost) {
  return {
    id: post.id,
    type: post.type,
    serviceCategory: post.serviceCategory,
    title: post.title,
    city: post.city,
    status: post.status,
    author: post.author
      ? {
          id: post.author.id,
          nickname: post.author.nickname,
          avatarUrl: post.author.avatarUrl,
          phone: post.author.phone,
        }
      : null,
    createdAt: post.createdAt,
  };
}

export function toAdminReviewDetail(post: HydratedPost) {
  return {
    id: post.id,
    type: post.type,
    serviceCategory: post.serviceCategory,
    status: post.status,
    title: post.title,
    content: post.content,
    city: post.city,
    images: getImages(post),
    author: post.author
      ? {
          id: post.author.id,
          nickname: post.author.nickname,
          avatarUrl: post.author.avatarUrl,
          phone: post.author.phone,
        }
      : null,
    contact: post.contact,
    adoptionDetail: post.adoptionDetail,
    secondHandDetail: post.secondHandDetail,
    homeFeedingDetail: post.homeFeedingDetail,
    boardingDetail: post.boardingDetail,
    reviewLogs: post.reviewLogs.map((log) => ({
      id: log.id,
      reviewerId: log.reviewerId,
      action: log.action,
      reason: log.reason,
      createdAt: log.createdAt,
    })),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

export function toPagedResult<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
) {
  return {
    items,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  };
}
