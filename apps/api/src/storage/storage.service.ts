import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export type UploadKind = 'avatar' | 'menu-image';

export interface ObjectStream {
  body: NodeJS.ReadableStream;
  contentType: string;
  contentLength?: number;
  etag?: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly enabled: boolean;
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  // True only when S3_PUBLIC_BASE_URL is explicitly set — i.e. the bucket (or a
  // CDN in front of it) is actually reachable by browsers. On Railway the
  // bucket is private, so this is false and we serve bytes through the API.
  private readonly hasPublicBase: boolean;
  private readonly forcePathStyle: boolean;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    this.bucket = process.env.S3_BUCKET ?? 'tabley-uploads';
    this.hasPublicBase = !!process.env.S3_PUBLIC_BASE_URL;
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
    // Only try to open the bucket for public read when the operator opted into a
    // public base URL. On a private Railway bucket we intentionally leave it
    // locked down and serve objects through GET /v1/files instead.
    if (!this.hasPublicBase) return;
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
      // Some providers (Railway, R2) don't support PutBucketPolicy; that's fine.
      this.logger.debug(`bucket policy not applied: ${(err as Error).message}`);
    }
  }

  isEnabled() {
    return this.enabled;
  }

  /**
   * Upload an arbitrary buffer to the configured bucket and return the URL the
   * browser should use to load it back (see `publicUrl`).
   */
  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    if (!this.client) throw new Error('Storage is not configured');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=86400',
      }),
    );
    return this.publicUrl(key);
  }

  /**
   * The URL a browser uses to load an object.
   *  - When S3_PUBLIC_BASE_URL is set (public bucket / CDN) → link directly.
   *  - Otherwise (private bucket, the Railway case) → route through our own
   *    streaming endpoint `GET /v1/files?key=<key>` so the server fetches the
   *    bytes with its credentials. FILES_PUBLIC_URL (falling back to
   *    BETTER_AUTH_URL, which is already the API's public origin on Railway)
   *    is the API base. The key is a query param so slashes in the key need no
   *    wildcard route matching (see FilesController).
   */
  publicUrl(key: string): string {
    if (this.hasPublicBase) {
      return this.directUrl(key);
    }
    const apiBase = (
      process.env.FILES_PUBLIC_URL ??
      process.env.BETTER_AUTH_URL ??
      ''
    ).replace(/\/$/, '');
    return `${apiBase}/v1/files?key=${encodeURIComponent(key)}`;
  }

  /** Direct bucket/CDN URL — only meaningful when the bucket is public. */
  private directUrl(key: string): string {
    if (this.forcePathStyle) {
      return `${this.publicBaseUrl}/${this.bucket}/${key}`;
    }
    return `${this.publicBaseUrl}/${key}`;
  }

  /** Fetch an object as a readable stream for the public serve endpoint. */
  async getObject(key: string): Promise<ObjectStream> {
    if (!this.client) throw new Error('Storage is not configured');
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return {
      body: res.Body as unknown as NodeJS.ReadableStream,
      contentType: res.ContentType ?? 'application/octet-stream',
      contentLength: res.ContentLength,
      etag: res.ETag,
    };
  }

  /** Guard against path traversal / odd keys before fetching from the bucket. */
  static isSafeKey(key: string): boolean {
    if (!key || key.length > 512) return false;
    if (key.startsWith('/')) return false;
    if (key.includes('..')) return false;
    if (key.includes('\\')) return false;
    return /^[a-zA-Z0-9/_.-]+$/.test(key);
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
