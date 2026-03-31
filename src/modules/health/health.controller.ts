import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get()
  async check() {
    await this.prismaService.$runCommandRaw({ ping: 1 });

    return {
      status: 'ok',
      service: 'pet-circle-server',
      environment: this.configService.get<string>('NODE_ENV'),
      timestamp: new Date().toISOString(),
    };
  }
}
