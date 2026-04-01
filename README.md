# Pet Circle Server

`pet-circle-server` 是给 `pet-circle-miniapp` 配套的后端服务模板，当前目标技术栈为 `NestJS + TypeScript + MongoDB + Prisma`。

## 已包含内容

- NestJS 11 基础项目结构
- Prisma + MongoDB 数据源配置
- 全局环境变量加载与校验
- 全局 `ValidationPipe`
- 基础健康检查接口 `GET /api/health`
- 按 superpowers 文档对齐的 MVP Prisma 数据模型

## 目录结构

```bash
.
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config/
│   │   └── env.validation.ts
│   ├── modules/
│   │   └── health/
│   └── prisma/
├── .env.example
└── package.json
```

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

```bash
cp .env.example .env
```

3. 修改 `.env` 中的 MongoDB 连接信息和微信小程序鉴权配置

```env
DATABASE_URL="mongodb://127.0.0.1:27017/pet_circle?directConnection=true"
WECHAT_APP_ID="wx-your-miniapp-appid"
WECHAT_APP_SECRET="replace-with-your-miniapp-secret"
```

4. 生成 Prisma Client

```bash
npm run prisma:generate
```

5. 将 schema 推送到 MongoDB

```bash
npm run db:push
```

6. 启动开发服务

```bash
npm run start:dev
```

服务默认运行在 `http://localhost:3000`。

## 常用命令

```bash
# 启动开发环境
npm run start:dev

# 构建
npm run build

# 单元测试
npm run test

# e2e 测试
npm run test:e2e

# Prisma
npm run prisma:generate
npm run prisma:studio
npm run db:push
```

## 当前默认接口

```http
GET /api/health
```

返回示例：

```json
{
  "status": "ok",
  "service": "pet-circle-server",
  "environment": "development",
  "timestamp": "2026-03-24T14:00:00.000Z"
}
```

## 下一步建议

- 增加用户模块、宠物模块、社区帖子模块
- 接入并联调真实微信小程序登录态校验
- 增加统一响应格式与异常过滤器
- 增加 seed 流程与按模块拆分的后端领域实现
