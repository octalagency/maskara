import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private client: S3Client | null = null;
  private bucket: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get('AWS_S3_BUCKET', 'maskara-recordings');
    const key = this.config.get('AWS_ACCESS_KEY_ID');
    const secret = this.config.get('AWS_SECRET_ACCESS_KEY');
    if (key && secret) {
      this.client = new S3Client({
        region: this.config.get('AWS_REGION', 'ap-southeast-1'),
        credentials: { accessKeyId: key, secretAccessKey: secret },
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client);
  }

  async uploadFromUrl(
    sourceUrl: string,
    key: string,
  ): Promise<string | null> {
    if (!this.client) {
      this.logger.warn('S3 not configured — skipping recording upload');
      return null;
    }

    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`Failed to fetch recording: ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: res.headers.get('content-type') || 'audio/mpeg',
      }),
    );

    const region = this.config.get('AWS_REGION', 'ap-southeast-1');
    const s3Url = `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
    this.logger.log(`Recording uploaded: ${key}`);
    return s3Url;
  }

  async uploadBuffer(buffer: Buffer, key: string, contentType: string) {
    if (!this.client) return null;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    const region = this.config.get('AWS_REGION', 'ap-southeast-1');
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}
