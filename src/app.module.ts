import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { PostsModule } from './modules/posts/posts.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PostsModule,
    NotificationsModule,
    ConversationsModule,
    ReviewsModule,
    HealthModule,
  ],
})
export class AppModule {}
