import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getCredential, getPolicy } from 'qcloud-cos-sts';
import type { AssetUploadKind } from './dto/create-cos-sts.dto';

type UploadCredentialOptions = {
  kind: AssetUploadKind;
  filename?: string;
};

const COS_STS_DURATION_SECONDS = 900;
const DEFAULT_EXTENSION = '.jpg';
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

@Injectable()
export class AssetsService {
  constructor(private readonly configService: ConfigService) {}

  async createCosUploadCredential(
    userId: string,
    options: UploadCredentialOptions,
  ) {
    const config = this.getCosConfig();
    const key = this.buildObjectKey(userId, options);
    const policy = getPolicy([
      {
        action: 'name/cos:PutObject',
        bucket: config.bucket,
        region: config.region,
        prefix: key,
      },
    ]);
    const credential = await getCredential({
      secretId: config.secretId,
      secretKey: config.secretKey,
      durationSeconds: COS_STS_DURATION_SECONDS,
      policy,
    });

    return {
      bucket: config.bucket,
      region: config.region,
      key,
      resourceUrl: this.buildResourceUrl(config.bucket, config.region, key),
      startTime: credential.startTime,
      expiredTime: credential.expiredTime,
      credentials: credential.credentials,
    };
  }

  private getCosConfig() {
    const secretId = this.configService.get<string>('COS_SECRET_ID')?.trim();
    const secretKey = this.configService.get<string>('COS_SECRET_KEY')?.trim();
    const bucket = this.configService.get<string>('COS_BUCKET')?.trim();
    const region = this.configService.get<string>('COS_REGION')?.trim();

    if (!secretId || !secretKey || !bucket || !region) {
      throw new InternalServerErrorException('COS upload is not configured.');
    }

    return {
      secretId,
      secretKey,
      bucket,
      region,
    };
  }

  private buildObjectKey(userId: string, options: UploadCredentialOptions) {
    const extension = this.resolveExtension(options.filename);
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);

    if (options.kind === 'avatar') {
      return `miniapp/avatar/${userId}/${timestamp}-${randomSuffix}${extension}`;
    }

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');

    return `miniapp/post/${userId}/${year}/${month}/${timestamp}-${randomSuffix}${extension}`;
  }

  private resolveExtension(filename?: string) {
    if (!filename) {
      return DEFAULT_EXTENSION;
    }

    const normalized = filename.toLowerCase().trim();
    const lastDotIndex = normalized.lastIndexOf('.');

    if (lastDotIndex < 0) {
      return DEFAULT_EXTENSION;
    }

    const extension = normalized.slice(lastDotIndex);
    return ALLOWED_EXTENSIONS.has(extension) ? extension : DEFAULT_EXTENSION;
  }

  private buildResourceUrl(bucket: string, region: string, key: string) {
    return `https://${bucket}.cos.${region}.myqcloud.com/${key}`;
  }
}
