import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('MINIO_ENDPOINT') ?? 'localhost';
    const port = config.get<number>('MINIO_PORT') ?? 9000;
    const accessKeyId = config.get<string>('MINIO_ACCESS_KEY') ?? 'minioadmin';
    const secretAccessKey = config.get<string>('MINIO_SECRET_KEY') ?? 'minioadmin';

    this.bucket = config.get<string>('MINIO_BUCKET') ?? 'operis';
    this.endpoint = `http://${host}:${port}`;

    this.client = new S3Client({
      endpoint: this.endpoint,
      region: 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    this.logger.log(`StorageService: endpoint=${this.endpoint}, bucket=${this.bucket}`);
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  async uploadFile(key: string, body: Buffer, contentType: string): Promise<void> {
    this.logger.log(`uploadFile: key=${key}, size=${body.length}, type=${contentType}`);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    this.logger.log(`uploadFile: uploaded key=${key}`);
  }

  getFileUrl(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  async getFile(key: string): Promise<{ body: Buffer; contentType: string }> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as any) {
      chunks.push(chunk);
    }
    return {
      body: Buffer.concat(chunks),
      contentType: result.ContentType ?? 'application/octet-stream',
    };
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`ensureBucket: bucket "${this.bucket}" already exists`);
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`ensureBucket: created bucket "${this.bucket}"`);
      } catch (createErr) {
        this.logger.error(`ensureBucket: failed to create bucket`, createErr);
      }
    }
  }
}
