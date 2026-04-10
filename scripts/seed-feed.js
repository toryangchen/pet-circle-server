const path = require("node:path");
const {
  PrismaClient,
  PostStatus,
  PostType,
  ServiceCategory,
  ReviewAction,
  AdminUserRole,
  AdminUserStatus,
} = require("@prisma/client");

if (typeof process.loadEnvFile === "function") {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to seed feed data.");
}

const prisma = new PrismaClient();

const seedUsers = [
  {
    openid: "seed-feed-author-pet-1",
    nickname: "西安遛狗日记",
    avatarUrl:
      "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=400&q=80",
    phone: "13800000011",
  },
  {
    openid: "seed-feed-author-pet-2",
    nickname: "猫咪观察员",
    avatarUrl:
      "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=400&q=80",
    phone: "13800000012",
  },
  {
    openid: "seed-feed-author-service-1",
    nickname: "未央区喂养助手",
    avatarUrl:
      "https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=400&q=80",
    phone: "13800000013",
  },
  {
    openid: "seed-feed-author-service-2",
    nickname: "寄养小院",
    avatarUrl:
      "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=400&q=80",
    phone: "13800000014",
  },
  {
    openid: "seed-feed-viewer-1",
    nickname: "种子浏览者",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
    phone: "13800000015",
  },
];

const seedAdmin = {
  username: "seed_feed_admin",
  passwordHash: "seed-feed-admin",
};

const basePetSocialSeeds = [
  {
    title: "傍晚在汉城湖遛狗，遇到超多友好毛孩子",
    content:
      "今天傍晚带金毛去汉城湖散步，沿路遇到很多会主动打招呼的宠友。准备以后固定在这边遛狗，顺便记录不同时间段的宠物友好程度。",
    city: "西安",
    authorOpenid: "seed-feed-author-pet-1",
    images: [
      "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=1200&q=80",
    ],
    comments: [
      {
        userOpenid: "seed-feed-viewer-1",
        content: "这个路线看起来好舒服，周末也适合带狗子去吗？",
        reply: "周末人会更多一点，但傍晚六点后还是挺合适的。",
      },
    ],
    likes: ["seed-feed-viewer-1", "seed-feed-author-pet-2"],
    favorites: ["seed-feed-viewer-1"],
    createdAt: new Date("2026-04-10T08:30:00.000Z"),
  },
  {
    title: "领养回家的小猫第一周，终于肯主动贴贴了",
    content:
      "小猫到家第七天，已经从躲沙发底变成会自己跳上沙发找人玩。想把这一周踩过的坑都整理一下，给新手领养家庭做参考。",
    city: "西安",
    authorOpenid: "seed-feed-author-pet-2",
    images: [
      "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=1200&q=80",
    ],
    comments: [
      {
        userOpenid: "seed-feed-viewer-1",
        content: "太有成就感了，等它主动靠近的过程真的很治愈。",
      },
    ],
    likes: ["seed-feed-viewer-1", "seed-feed-author-pet-1"],
    favorites: ["seed-feed-viewer-1", "seed-feed-author-service-1"],
    createdAt: new Date("2026-04-10T07:45:00.000Z"),
  },
];

const generatedPetSocialSeeds = Array.from({ length: 18 }, (_, index) => {
  const seedIndex = index + 3;
  const hour = 7 - Math.floor(index / 3);
  const minute = (index % 3) * 15;
  const authorOpenid = index % 2 === 0 ? "seed-feed-author-pet-1" : "seed-feed-author-pet-2";
  const city = index % 4 === 0 ? "咸阳" : "西安";
  const image =
    index % 2 === 0
      ? "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=1200&q=80"
      : "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=1200&q=80";

  return {
    title: `宠友圈分页样例第${seedIndex}条`,
    content: `这是为首页分页联调准备的第${seedIndex}条宠友圈种子数据，用来验证接口在第${Math.ceil(seedIndex / 10)}页仍然能稳定返回内容。`,
    city,
    authorOpenid,
    images: [image],
    comments:
      index % 3 === 0
        ? [
            {
              userOpenid: "seed-feed-viewer-1",
              content: `第${seedIndex}条评论样例，方便确认评论数也会进入 feed 统计。`,
            },
          ]
        : [],
    likes: index % 2 === 0 ? ["seed-feed-viewer-1"] : ["seed-feed-author-service-1"],
    favorites: index % 4 === 0 ? ["seed-feed-viewer-1"] : [],
    createdAt: new Date(
      `2026-04-10T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`,
    ),
  };
});

const petSocialSeeds = [...basePetSocialSeeds, ...generatedPetSocialSeeds];

const serviceSeeds = [
  {
    title: "未央区可上门喂猫，支持早晚两次拍照反馈",
    content:
      "主要服务未央区凤城一路到凤城八路，擅长照顾多猫家庭。可提供喂食、换水、清理猫砂和基础陪玩，服务后会统一发照片与视频。",
    city: "西安",
    type: PostType.SERVICE,
    serviceCategory: ServiceCategory.HOME_FEEDING,
    authorOpenid: "seed-feed-author-service-1",
    images: [
      "https://images.unsplash.com/photo-1511044568932-338cba0ad803?auto=format&fit=crop&w=1200&q=80",
    ],
    contact: {
      wechatId: "weiyang-feed-helper",
      phone: "13800000013",
      contactName: "阿宁",
    },
    detail: {
      kind: "homeFeedingDetail",
      data: {
        serviceArea: "未央区凤城一路到凤城八路",
        availableTime: "工作日早晚、周末全天",
        price: "35元/次",
      },
    },
    likes: ["seed-feed-viewer-1"],
    favorites: ["seed-feed-author-pet-1"],
    createdAt: new Date("2026-04-10T06:50:00.000Z"),
  },
  {
    title: "南郊家庭寄养，独立房间和每日遛放",
    content:
      "家里有单独宠物房和封闭阳台，适合中小型犬和亲人猫短住。每天会更新喂食、遛放和状态记录，节假日可提前预约。",
    city: "西安",
    type: PostType.SERVICE,
    serviceCategory: ServiceCategory.BOARDING,
    authorOpenid: "seed-feed-author-service-2",
    images: [
      "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1561037404-61cd46aa615b?auto=format&fit=crop&w=1200&q=80",
    ],
    contact: {
      wechatId: "boarding-yard-xa",
      phone: "13800000014",
      contactName: "小满",
    },
    detail: {
      kind: "boardingDetail",
      data: {
        boardingEnvironment: "独立宠物房，全天候空调，支持视频查看",
        acceptedPetTypes: ["猫", "小型犬", "中型犬"],
        price: "88元/天",
      },
    },
    likes: ["seed-feed-viewer-1", "seed-feed-author-pet-2"],
    favorites: ["seed-feed-author-pet-1", "seed-feed-viewer-1"],
    createdAt: new Date("2026-04-10T05:40:00.000Z"),
  },
];

async function upsertUser(user) {
  return prisma.user.upsert({
    where: { openid: user.openid },
    update: {
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bgType: "main-bg-01",
      phone: user.phone,
      phoneAuthorized: true,
      profileAuthorized: true,
      cityDefault: "西安",
    },
    create: {
      openid: user.openid,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bgType: "main-bg-01",
      phone: user.phone,
      phoneAuthorized: true,
      profileAuthorized: true,
      cityDefault: "西安",
    },
  });
}

async function cleanupExistingSeedPosts() {
  const existingPosts = await prisma.post.findMany({
    where: {
      OR: [
        {
          title: {
            startsWith: "[Seed Feed]",
          },
        },
        {
          title: "傍晚在汉城湖遛狗，遇到超多友好毛孩子",
        },
        {
          title: "领养回家的小猫第一周，终于肯主动贴贴了",
        },
        {
          title: "未央区可上门喂猫，支持早晚两次拍照反馈",
        },
        {
          title: "南郊家庭寄养，独立房间和每日遛放",
        },
        {
          title: {
            startsWith: "宠友圈分页样例第",
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  const postIds = existingPosts.map((post) => post.id);
  if (postIds.length === 0) {
    return;
  }

  await prisma.conversationMessage.deleteMany({
    where: {
      conversationId: {
        in: (
          await prisma.conversation.findMany({
            where: {
              postId: {
                in: postIds,
              },
            },
            select: { id: true },
          })
        ).map((item) => item.id),
      },
    },
  });
  await prisma.conversation.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.notification.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.comment.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.like.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.favorite.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.reviewLog.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.postAsset.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.postContact.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.adoptionDetail.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.secondHandDetail.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.homeFeedingDetail.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.boardingDetail.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.post.deleteMany({ where: { id: { in: postIds } } });
}

async function ensureSeedAdmin() {
  return prisma.adminUser.upsert({
    where: { username: seedAdmin.username },
    update: {
      passwordHash: seedAdmin.passwordHash,
      role: AdminUserRole.SUPER_ADMIN,
      status: AdminUserStatus.ACTIVE,
    },
    create: {
      username: seedAdmin.username,
      passwordHash: seedAdmin.passwordHash,
      role: AdminUserRole.SUPER_ADMIN,
      status: AdminUserStatus.ACTIVE,
    },
  });
}

async function createAssets(postId, urls) {
  const assets = [];
  for (const [index, url] of urls.entries()) {
    const asset = await prisma.postAsset.create({
      data: {
        postId,
        url,
        sortOrder: index,
      },
    });
    assets.push(asset);
  }

  if (assets[0]) {
    await prisma.post.update({
      where: { id: postId },
      data: { coverAssetId: assets[0].id },
    });
  }
}

async function createPostEngagement(post, usersByOpenid) {
  for (const likerOpenid of post.likes ?? []) {
    await prisma.like.create({
      data: {
        postId: post.id,
        userId: usersByOpenid.get(likerOpenid).id,
      },
    });
  }

  for (const favoriteOpenid of post.favorites ?? []) {
    await prisma.favorite.create({
      data: {
        postId: post.id,
        userId: usersByOpenid.get(favoriteOpenid).id,
      },
    });
  }

  for (const commentSeed of post.comments ?? []) {
    const comment = await prisma.comment.create({
      data: {
        postId: post.id,
        userId: usersByOpenid.get(commentSeed.userOpenid).id,
        content: commentSeed.content,
      },
    });

    if (commentSeed.reply) {
      await prisma.comment.create({
        data: {
          postId: post.id,
          userId: usersByOpenid.get(post.authorOpenid).id,
          parentId: comment.id,
          rootId: comment.id,
          content: commentSeed.reply,
        },
      });
    }
  }
}

async function createPetSocialPost(seed, usersByOpenid, adminUser) {
  const author = usersByOpenid.get(seed.authorOpenid);
  const post = await prisma.post.create({
    data: {
      type: PostType.PET_SOCIAL,
      serviceCategory: null,
      title: seed.title,
      content: seed.content,
      city: seed.city,
      status: PostStatus.APPROVED,
      authorId: author.id,
      publishedAt: seed.createdAt,
      approvedAt: seed.createdAt,
      createdAt: seed.createdAt,
    },
  });

  await createAssets(post.id, seed.images);
  await prisma.reviewLog.create({
    data: {
      postId: post.id,
      reviewerId: adminUser.id,
      action: ReviewAction.APPROVE,
    },
  });
  await createPostEngagement({ ...seed, id: post.id }, usersByOpenid);
  return post;
}

async function createServicePost(seed, usersByOpenid, adminUser) {
  const author = usersByOpenid.get(seed.authorOpenid);
  const post = await prisma.post.create({
    data: {
      type: seed.type,
      serviceCategory: seed.serviceCategory,
      title: seed.title,
      content: seed.content,
      city: seed.city,
      status: PostStatus.APPROVED,
      authorId: author.id,
      publishedAt: seed.createdAt,
      approvedAt: seed.createdAt,
      createdAt: seed.createdAt,
    },
  });

  await createAssets(post.id, seed.images);
  await prisma.postContact.create({
    data: {
      postId: post.id,
      wechatId: seed.contact.wechatId,
      phone: seed.contact.phone,
      contactName: seed.contact.contactName,
    },
  });

  if (seed.detail.kind === "homeFeedingDetail") {
    await prisma.homeFeedingDetail.create({
      data: {
        postId: post.id,
        ...seed.detail.data,
      },
    });
  }

  if (seed.detail.kind === "boardingDetail") {
    await prisma.boardingDetail.create({
      data: {
        postId: post.id,
        ...seed.detail.data,
      },
    });
  }

  await prisma.reviewLog.create({
    data: {
      postId: post.id,
      reviewerId: adminUser.id,
      action: ReviewAction.APPROVE,
    },
  });
  await createPostEngagement({ ...seed, id: post.id }, usersByOpenid);
  return post;
}

async function main() {
  const users = [];
  for (const user of seedUsers) {
    users.push(await upsertUser(user));
  }

  const usersByOpenid = new Map(users.map((user) => [user.openid, user]));
  await cleanupExistingSeedPosts();
  const adminUser = await ensureSeedAdmin();

  const createdPetPosts = [];
  for (const seed of petSocialSeeds) {
    createdPetPosts.push(await createPetSocialPost(seed, usersByOpenid, adminUser));
  }

  const createdServicePosts = [];
  for (const seed of serviceSeeds) {
    createdServicePosts.push(await createServicePost(seed, usersByOpenid, adminUser));
  }

  const homeFeed = await prisma.post.findMany({
    where: {
      type: PostType.PET_SOCIAL,
      status: PostStatus.APPROVED,
    },
    include: {
      author: true,
      assets: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
          favorites: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  console.log(
    JSON.stringify(
      {
        inserted: {
          petSocial: createdPetPosts.map((post) => post.id),
          service: createdServicePosts.map((post) => post.id),
        },
        homeFeedPreview: homeFeed.map((post) => ({
          id: post.id,
          type: post.type,
          serviceCategory: post.serviceCategory,
          title: post.title,
          city: post.city,
          author: post.author?.nickname ?? null,
          coverImage: post.assets[0]?.url ?? null,
          stats: {
            likeCount: post._count.likes,
            commentCount: post._count.comments,
            favoriteCount: post._count.favorites,
          },
          createdAt: post.createdAt,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
