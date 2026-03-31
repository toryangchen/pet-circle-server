import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.DATABASE_URL =
  'mongodb://127.0.0.1:27017/pet_circle_test?directConnection=true';
process.env.JWT_SECRET = 'test-miniapp-secret';
process.env.WECHAT_APP_ID = 'wx-test-appid';
process.env.WECHAT_APP_SECRET = 'wx-test-secret';

import { AppModule } from './../src/app.module';
import { applyGlobalAppSetup } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;
  const runCommandRaw = jest.fn().mockResolvedValue({ ok: 1 });

  beforeEach(async () => {
    runCommandRaw.mockClear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: jest.fn(),
        $runCommandRaw: runCommandRaw,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    applyGlobalAppSetup(app);
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(runCommandRaw).toHaveBeenCalledWith({ ping: 1 });
        expect(body).toEqual(
          expect.objectContaining({
            status: 'ok',
            service: 'pet-circle-server',
            environment: 'test',
            timestamp: expect.any(String),
          }),
        );
        expect(Object.keys(body).sort()).toEqual([
          'environment',
          'service',
          'status',
          'timestamp',
        ]);
      });
  });
});
