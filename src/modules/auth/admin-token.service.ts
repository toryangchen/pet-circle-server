import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

type AdminTokenPayload = {
  sub: string;
  type: 'admin';
  iat: number;
  exp: number;
};

const ADMIN_TOKEN_TTL_SECONDS = 12 * 60 * 60;

@Injectable()
export class AdminTokenService {
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.secret =
      this.configService.get<string>('ADMIN_JWT_SECRET') ??
      this.configService.getOrThrow<string>('JWT_SECRET');
  }

  sign(adminUserId: string): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: AdminTokenPayload = {
      sub: adminUserId,
      type: 'admin',
      iat: issuedAt,
      exp: issuedAt + ADMIN_TOKEN_TTL_SECONDS,
    };

    return this.signPayload(payload);
  }

  verify(token: string): AdminTokenPayload {
    const segments = token.split('.');
    if (segments.length !== 3) {
      throw new UnauthorizedException('Invalid admin token.');
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
      throw new UnauthorizedException('Invalid admin token.');
    }

    const payload = this.parsePayload(encodedPayload);

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Admin token expired or invalid.');
    }

    return payload;
  }

  private signPayload(payload: AdminTokenPayload): string {
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

  private parsePayload(encodedPayload: string): AdminTokenPayload {
    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as Partial<AdminTokenPayload>;

      if (
        typeof payload.sub !== 'string' ||
        payload.type !== 'admin' ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number'
      ) {
        throw new Error('Invalid payload shape.');
      }

      return payload as AdminTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid admin token.');
    }
  }
}
