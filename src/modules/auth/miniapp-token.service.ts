import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

type MiniappTokenPayload = {
  sub: string;
  type: 'miniapp';
  iat: number;
  exp: number;
};

const MINIAPP_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class MiniappTokenService {
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.getOrThrow<string>('JWT_SECRET');
  }

  sign(userId: string): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: MiniappTokenPayload = {
      sub: userId,
      type: 'miniapp',
      iat: issuedAt,
      exp: issuedAt + MINIAPP_TOKEN_TTL_SECONDS,
    };

    return this.signPayload(payload);
  }

  verify(token: string): MiniappTokenPayload {
    const segments = token.split('.');
    if (segments.length !== 3) {
      throw new UnauthorizedException('Invalid miniapp token.');
    }

    const [encodedHeader, encodedPayload, signature] = segments;
    const expectedSignature = this.createSignature(
      `${encodedHeader}.${encodedPayload}`,
    );
    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedSignatureBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
    ) {
      throw new UnauthorizedException('Invalid miniapp token.');
    }

    const payload = this.parsePayload(encodedPayload);

    if (
      payload.type !== 'miniapp' ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException('Miniapp token expired or invalid.');
    }

    return payload;
  }

  private signPayload(payload: MiniappTokenPayload): string {
    const encodedHeader = Buffer.from(
      JSON.stringify({
        alg: 'HS256',
        typ: 'JWT',
      }),
      'utf8',
    ).toString('base64url');
    const encodedPayload = Buffer.from(
      JSON.stringify(payload),
      'utf8',
    ).toString('base64url');
    const signature = this.createSignature(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private createSignature(content: string): string {
    return createHmac('sha256', this.secret)
      .update(content)
      .digest('base64url');
  }

  private parsePayload(encodedPayload: string): MiniappTokenPayload {
    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as Partial<MiniappTokenPayload>;

      if (
        typeof payload.sub !== 'string' ||
        payload.type !== 'miniapp' ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number'
      ) {
        throw new Error('Invalid payload shape.');
      }

      return payload as MiniappTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid miniapp token.');
    }
  }
}
