import { ConfigService } from '@nestjs/config';
import { getCredential, getPolicy } from 'qcloud-cos-sts';
import { AssetsService } from './assets.service';

jest.mock('qcloud-cos-sts', () => ({
  getCredential: jest.fn(),
  getPolicy: jest.fn(),
}));

describe('AssetsService', () => {
  const getCredentialMock = getCredential as jest.MockedFunction<
    typeof getCredential
  >;
  const getPolicyMock = getPolicy as jest.MockedFunction<typeof getPolicy>;

  beforeEach(() => {
    getCredentialMock.mockReset();
    getPolicyMock.mockReset();
  });

  it('creates a temporary COS credential for avatar uploads', async () => {
    const configService = new ConfigService({
      COS_SECRET_ID: 'server-secret-id',
      COS_SECRET_KEY: 'server-secret-key',
      COS_BUCKET: 'petcircle-1322740877',
      COS_REGION: 'ap-beijing',
    });

    getPolicyMock.mockReturnValue({
      version: '2.0',
      statement: [],
    });
    getCredentialMock.mockResolvedValue({
      credentials: {
        tmpSecretId: 'tmp-secret-id',
        tmpSecretKey: 'tmp-secret-key',
        sessionToken: 'tmp-session-token',
      },
      startTime: 1712912400,
      expiredTime: 1712913300,
      requestId: 'request-1',
    });

    const service = new AssetsService(configService);

    const result = await service.createCosUploadCredential('user-123', {
      kind: 'avatar',
      filename: 'buddy.png',
    });

    expect(getPolicyMock).toHaveBeenCalledWith([
      expect.objectContaining({
        action: 'name/cos:PutObject',
        bucket: 'petcircle-1322740877',
        region: 'ap-beijing',
        prefix: result.key,
      }),
    ]);
    expect(getCredentialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        secretId: 'server-secret-id',
        secretKey: 'server-secret-key',
        durationSeconds: 900,
        policy: {
          version: '2.0',
          statement: [],
        },
      }),
    );
    expect(result).toEqual({
      bucket: 'petcircle-1322740877',
      region: 'ap-beijing',
      key: expect.stringMatching(
        /^miniapp\/avatar\/user-123\/\d+-[a-z0-9]{6}\.png$/,
      ),
      resourceUrl: expect.stringMatching(
        /^https:\/\/petcircle-1322740877\.cos\.ap-beijing\.myqcloud\.com\/miniapp\/avatar\/user-123\/\d+-[a-z0-9]{6}\.png$/,
      ),
      startTime: 1712912400,
      expiredTime: 1712913300,
      credentials: {
        tmpSecretId: 'tmp-secret-id',
        tmpSecretKey: 'tmp-secret-key',
        sessionToken: 'tmp-session-token',
      },
    });
  });

  it('throws when COS configuration is missing', async () => {
    const service = new AssetsService(new ConfigService({}));

    await expect(
      service.createCosUploadCredential('user-123', {
        kind: 'avatar',
        filename: 'buddy.png',
      }),
    ).rejects.toThrow('COS upload is not configured.');
  });
});
