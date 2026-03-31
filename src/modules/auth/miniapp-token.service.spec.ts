import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import { MiniappTokenService } from './miniapp-token.service';

describe('MiniappTokenService', () => {
  let miniappTokenService: MiniappTokenService;
  const secret = 'test-miniapp-secret';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MiniappTokenService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') {
                return secret;
              }

              throw new Error(`Unexpected config key: ${key}`);
            }),
          },
        },
      ],
    }).compile();

    miniappTokenService = module.get(MiniappTokenService);
  });

  it('rejects a signed three-segment token when the payload is not valid JSON', () => {
    const encodedHeader = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
      'utf8',
    ).toString('base64url');
    const encodedPayload = Buffer.from('not-json', 'utf8').toString(
      'base64url',
    );
    const signature = createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    expect(() =>
      miniappTokenService.verify(
        `${encodedHeader}.${encodedPayload}.${signature}`,
      ),
    ).toThrow(new UnauthorizedException('Invalid miniapp token.'));
  });
});
