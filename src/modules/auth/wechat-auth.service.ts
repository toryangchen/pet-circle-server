import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type WeChatLoginSession = {
  openid: string;
  unionid?: string;
};

export type WeChatPhoneInfo = {
  phoneNumber: string;
};

export abstract class WeChatAuthService {
  abstract exchangeLoginCode(code: string): Promise<WeChatLoginSession>;

  abstract exchangePhoneCode(code: string): Promise<WeChatPhoneInfo>;
}

@Injectable()
export class DefaultWeChatAuthService implements WeChatAuthService {
  constructor(private readonly configService: ConfigService) {}

  async exchangeLoginCode(code: string): Promise<WeChatLoginSession> {
    const { appId, appSecret } = this.getConfig();
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.searchParams.set('appid', appId);
    url.searchParams.set('secret', appSecret);
    url.searchParams.set('js_code', code);
    url.searchParams.set('grant_type', 'authorization_code');

    const response = await this.fetchJson<{
      errcode?: number;
      errmsg?: string;
      openid?: string;
      unionid?: string;
    }>(url.toString(), {
      method: 'GET',
    });

    if (response.errcode) {
      throw this.toWeChatException(response.errcode, 'login');
    }

    if (!response.openid) {
      throw new BadGatewayException('WeChat login response is missing openid.');
    }

    return {
      openid: response.openid,
      unionid: response.unionid,
    };
  }

  async exchangePhoneCode(code: string): Promise<WeChatPhoneInfo> {
    const accessToken = await this.getAccessToken();
    const response = await this.fetchJson<{
      errcode?: number;
      errmsg?: string;
      phone_info?: {
        phoneNumber?: string;
        purePhoneNumber?: string;
      };
    }>(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      },
    );

    if (response.errcode) {
      throw this.toWeChatException(response.errcode, 'phone');
    }

    const phoneNumber =
      response.phone_info?.phoneNumber ?? response.phone_info?.purePhoneNumber;

    if (!phoneNumber) {
      throw new BadGatewayException(
        'WeChat phone response is missing phoneNumber.',
      );
    }

    return { phoneNumber };
  }

  private async getAccessToken() {
    const { appId, appSecret } = this.getConfig();
    const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', appId);
    url.searchParams.set('secret', appSecret);

    const response = await this.fetchJson<{
      errcode?: number;
      errmsg?: string;
      access_token?: string;
    }>(url.toString(), {
      method: 'GET',
    });

    if (response.errcode || !response.access_token) {
      throw new BadGatewayException('WeChat access token request failed.');
    }

    return response.access_token;
  }

  private getConfig() {
    const appId = this.configService.get<string>('WECHAT_APP_ID');
    const appSecret = this.configService.get<string>('WECHAT_APP_SECRET');

    if (!appId || !appSecret) {
      throw new ServiceUnavailableException(
        'WeChat miniapp provider is not configured.',
      );
    }

    return { appId, appSecret };
  }

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url, init);
    } catch {
      throw new BadGatewayException('WeChat request failed.');
    }

    if (!response.ok) {
      throw new BadGatewayException('WeChat request failed.');
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new BadGatewayException('WeChat response is invalid.');
    }
  }

  private toWeChatException(errcode: number, operation: 'login' | 'phone') {
    if (errcode === 40029) {
      return new UnauthorizedException(
        operation === 'login'
          ? 'WeChat login code is invalid or expired.'
          : 'WeChat phone code is invalid or expired.',
      );
    }

    return new BadGatewayException(
      operation === 'login' ? 'WeChat login failed.' : 'WeChat phone lookup failed.',
    );
  }
}
