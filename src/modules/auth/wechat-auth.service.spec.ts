import {
  BadGatewayException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DefaultWeChatAuthService } from './wechat-auth.service';

describe('DefaultWeChatAuthService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function createConfigService(
    values: Partial<Record<'WECHAT_APP_ID' | 'WECHAT_APP_SECRET', string>>,
  ) {
    return {
      get: jest.fn((key: string) => values[key as keyof typeof values]),
    } as Pick<ConfigService, 'get'>;
  }

  async function createService(
    values: Partial<Record<'WECHAT_APP_ID' | 'WECHAT_APP_SECRET', string>>,
  ) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DefaultWeChatAuthService,
        {
          provide: ConfigService,
          useValue: createConfigService(values),
        },
      ],
    }).compile();

    return module.get(DefaultWeChatAuthService);
  }

  it('exchanges a miniapp login code for openid and unionid', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        openid: 'openid-1',
        unionid: 'unionid-1',
      }),
    });
    global.fetch = fetchMock as typeof fetch;
    const service = await createService({
      WECHAT_APP_ID: 'wx-test-appid',
      WECHAT_APP_SECRET: 'wx-test-secret',
    });

    await expect(service.exchangeLoginCode('wx-login-code')).resolves.toEqual({
      openid: 'openid-1',
      unionid: 'unionid-1',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://api.weixin.qq.com/sns/jscode2session?'),
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('exchanges a miniapp phone code for the user phone number', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'wechat-access-token',
          expires_in: 7200,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          phone_info: {
            phoneNumber: '13812345678',
          },
        }),
      });
    global.fetch = fetchMock as typeof fetch;
    const service = await createService({
      WECHAT_APP_ID: 'wx-test-appid',
      WECHAT_APP_SECRET: 'wx-test-secret',
    });

    await expect(service.exchangePhoneCode('wx-phone-code')).resolves.toEqual({
      phoneNumber: '13812345678',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=wechat-access-token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'wx-phone-code' }),
      }),
    );
  });

  it('fails fast when wechat miniapp config is missing', async () => {
    const service = await createService({});

    await expect(service.exchangeLoginCode('wx-login-code')).rejects.toThrow(
      new ServiceUnavailableException(
        'WeChat miniapp provider is not configured.',
      ),
    );
  });

  it('translates wechat login errors into unauthorized exceptions', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        errcode: 40029,
        errmsg: 'invalid code',
      }),
    }) as typeof fetch;
    const service = await createService({
      WECHAT_APP_ID: 'wx-test-appid',
      WECHAT_APP_SECRET: 'wx-test-secret',
    });

    await expect(service.exchangeLoginCode('wx-login-code')).rejects.toThrow(
      new UnauthorizedException('WeChat login code is invalid or expired.'),
    );
  });

  it('translates invalid wechat phone codes into unauthorized exceptions', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'wechat-access-token',
          expires_in: 7200,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errcode: 40029,
          errmsg: 'invalid code',
        }),
      }) as typeof fetch;
    const service = await createService({
      WECHAT_APP_ID: 'wx-test-appid',
      WECHAT_APP_SECRET: 'wx-test-secret',
    });

    await expect(service.exchangePhoneCode('wx-phone-code')).rejects.toThrow(
      new UnauthorizedException('WeChat phone code is invalid or expired.'),
    );
  });
});
