import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export type UploadKind = 'avatar' | 'menu-image';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly enabled: boolean;
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly forcePathStyle: boolean;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    this.bucket = process.env.S3_BUCKET ?? 'tabley-uploads';
    this.publicBaseUrl = (process.env.S3_PUBLIC_BASE_URL ?? endpoint ?? '').replace(/\/$/, '');
    this.forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      this.enabled = false;
      this.client = null;
      this.logger.warn('S3 storage not configured — uploads disabled');
      return;
    }

    this.enabled = true;
    this.client = new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: this.forcePathStyle,
    });
  }

  async onModuleInit() {
    if (!this.client) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`s3 bucket ${this.bucket} ready`);
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`s3 bucket ${this.bucket} created`);
      } catch (err) {
        this.logger.warn(`could not create bucket ${this.bucket}: ${(err as Error).message}`);
        return;
      }
    }
    // Make object reads public so the browser can fetch uploaded avatars directly.
    try {
      const policy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      });
      await this.client.send(
        new PutBucketPolicyCommand({ Bucket: this.bucket, Policy: policy }),
      );
    } catch (err) {
      // Some providers (Railway, R2) don't support PutBucketPolicy; that's fine,
      // the bucket may already be configured for public read at the provider level.
      this.logger.debug(`bucket policy not applied: ${(err as Error).message}`);
    }
  }

  isEnabled() {
    return this.enabled;
  }

  /**
   * Upload an arbitrary buffer to the configured bucket and return its public URL.
   */
  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    if (!this.client) throw new Error('Storage is not configured');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // CacheControl: 1 day; clients should bust by rotating the key when content changes.
        CacheControl: 'public, max-age=86400',
      }),
    );
    return this.publicUrlFor(key);
  }

  publicUrlFor(key: string): string {
    if (this.forcePathStyle) {
      return `${this.publicBaseUrl}/${this.bucket}/${key}`;
    }
    return `${this.publicBaseUrl}/${key}`;
  }

  /**
   * Parse a data URL (`data:image/jpeg;base64,...`) into a buffer + mime tuple.
   * Rejects anything that isn't a base64-encoded image.
   */
  static decodeDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
    const match = /^data:([\w/+-]+);base64,(.+)$/i.exec(dataUrl);
    if (!match) throw new Error('Expected a base64 data URL');
    const mimeType = match[1]!;
    if (!mimeType.startsWith('image/')) throw new Error('Only image uploads are accepted');
    const buffer = Buffer.from(match[2]!, 'base64');
    return { buffer, mimeType };
  }
}
