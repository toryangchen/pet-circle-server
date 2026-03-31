import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('HealthController', () => {
  let healthController: HealthController;
  const runCommandRaw = jest.fn().mockResolvedValue({ ok: 1 });

  beforeEach(async () => {
    runCommandRaw.mockClear();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $runCommandRaw: runCommandRaw,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test'),
          },
        },
      ],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('check', () => {
    it('returns the health status payload', async () => {
      const result = await healthController.check();

      expect(runCommandRaw).toHaveBeenCalledWith({ ping: 1 });
      expect(result.status).toBe('ok');
      expect(result.service).toBe('pet-circle-server');
      expect(result.environment).toBe('test');
      expect(result.timestamp).toEqual(expect.any(String));
    });
  });
});
