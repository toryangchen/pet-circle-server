import { NestFactory } from '@nestjs/core';
import { applyGlobalAppSetup } from './app.setup';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  applyGlobalAppSetup(app);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
