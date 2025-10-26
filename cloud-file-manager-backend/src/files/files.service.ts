import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileUpload, FileUploadStatus } from './entities/file-upload.entity';
import { User, UserRole } from '../users/entity/user.entity';
import { UsersService } from '../users/users.service';
import { FILES_S3_CLIENT } from './files.constants';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createHash, createCipheriv, randomBytes } from 'crypto';
import { LoggerService } from '../logger/logger.service';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream, promises as fsPromises } from 'fs';
import { Upload } from '@aws-sdk/lib-storage';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { PresignedUrlResponseDto } from './dto/presigned-url-response.dto';
import type { Express } from 'express';

@Injectable()
export class FilesService {
  private readonly bucket: string;
  private readonly maxUploadBytes: number;
  private readonly downloadUrlTtlSeconds: number;
  private readonly encryptionKey: Buffer;
  private readonly allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel'];
  private readonly uploadPartSize: number;
  private readonly uploadQueueSize: number;

  constructor(
    @InjectRepository(FileUpload)
    private readonly filesRepository: Repository<FileUpload>,
    @Inject(FILES_S3_CLIENT) private readonly s3: S3Client,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly usersService: UsersService,
  ) {
    const bucket = this.configService.get<string>('FILES_BUCKET_NAME');
    if (!bucket) {
      throw new Error('FILES_BUCKET_NAME is not configured');
    }
    this.bucket = bucket;
    this.maxUploadBytes = parseInt(
      this.configService.get<string>('MAX_UPLOAD_BYTES', '52428800'),
      10,
    );
    this.downloadUrlTtlSeconds = parseInt(
      this.configService.get<string>('FILES_DOWNLOAD_URL_TTL_SECONDS', '60'),
      10,
    );
    this.uploadPartSize = parseInt(
      this.configService.get<string>('FILES_MULTIPART_PART_SIZE', '8388608'),
      10,
    );
    this.uploadQueueSize = parseInt(
      this.configService.get<string>('FILES_MULTIPART_QUEUE', '4'),
      10,
    );
    const encryptionKeyBase64 = this.configService.get<string>(
      'FILE_NAME_ENCRYPTION_KEY',
    );
    if (!encryptionKeyBase64) {
      throw new Error('FILE_NAME_ENCRYPTION_KEY is not configured');
    }
    const key = Buffer.from(encryptionKeyBase64, 'base64');
    if (key.length !== 32) {
      throw new Error(
        'FILE_NAME_ENCRYPTION_KEY must be a 32-byte base64-encoded string',
      );
    }
    this.encryptionKey = key;
  }

  async uploadMany(
    user: User,
    files: Express.Multer.File[],
  ): Promise<FileUploadResponseDto[]> {
    await this.ensureUserExists(user.id);
    if (!files || files.length === 0) {
      throw new BadRequestException({
        code: 'NO_FILES',
        message: 'At least one file must be provided',
      });
    }

    const results: FileUpload[] = [];
    for (const file of files) {
      this.validateFile(file);
      const uploaded = await this.uploadSingle(user, file);
      results.push(uploaded);
    }

    return results.map((file) => this.toResponseDto(file));
  }

  async listUserFiles(
    user: User,
    query: ListFilesQueryDto,
  ): Promise<{
    data: FileUploadResponseDto[];
    meta: { page: number; limit: number; total: number };
  }> {
    const { qb, page, limit } = this.createListQueryBuilder(query);
    qb.andWhere('file.ownerId = :ownerId', { ownerId: user.id });
    const [data, total] = await qb.getManyAndCount();
    return {
      data: data.map((file) => this.toResponseDto(file)),
      meta: { page, limit, total },
    };
  }

  async listAllFiles(query: ListFilesQueryDto): Promise<{
    data: FileUploadResponseDto[];
    meta: { page: number; limit: number; total: number };
  }> {
    const { qb, page, limit } = this.createListQueryBuilder(query);
    const [data, total] = await qb.getManyAndCount();
    return {
      data: data.map((file) => this.toResponseDto(file)),
      meta: { page, limit, total },
    };
  }

  async generateDownloadUrl(
    fileId: string,
    user: User,
  ): Promise<PresignedUrlResponseDto> {
    const file = await this.getOwnedFileOrThrow(fileId, user);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: file.s3Key,
    });
    const url = await getSignedUrl(this.s3, command, {
      expiresIn: this.downloadUrlTtlSeconds,
    });
    const expiresAt = new Date(
      Date.now() + this.downloadUrlTtlSeconds * 1000,
    ).toISOString();

    this.logger.log(
      `Generated download URL for file ${file.id} (owner: ${file.ownerId}): ${url}`,
    );
    return { url, expiresAt };
  }

  async softDelete(fileId: string, user: User) {
    const file = await this.getOwnedFileOrThrow(fileId, user);
    file.status = FileUploadStatus.SOFT_DELETED;
    file.softDeletedAt = new Date();
    await this.filesRepository.save(file);
    return {
      code: 'FILE_SOFT_DELETED',
      fileId: file.id,
    };
  }

  private validateFile(file: Express.Multer.File) {
    if (file.size > this.maxUploadBytes) {
      throw new PayloadTooLargeException({
        code: 'UPLOAD_TOO_LARGE',
        message: `File size exceeds limit of ${this.maxUploadBytes} bytes`,
      });
    }
    const mimeType = file.mimetype ?? '';
    if (!this.allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: 'Only CSV uploads are supported at this time',
      });
    }
    if (!file.path) {
      throw new BadRequestException({
        code: 'FILE_PATH_MISSING',
        message: 'File path missing for uploaded file',
      });
    }
  }

  private async uploadSingle(user: User, file: Express.Multer.File) {
    const s3Key = `${user.id}/${randomUUID()}`;
    const filePath = file.path;
    if (!filePath) {
      throw new InternalServerErrorException({
        code: 'FILE_PATH_MISSING',
        message: 'File path not available for upload',
      });
    }
    const checksum = await this.computeChecksum(filePath);
    const originalName = String(file.originalname ?? 'file.csv');
    const encryptedName = this.encryptFileName(originalName);

    try {
      await this.uploadStreamToS3({
        filePath,
        s3Key,
        mimeType: file.mimetype ?? 'application/octet-stream',
        contentLength: file.size,
      });
    } catch (error) {
      this.logger.error('S3 upload failed', String(error));
      throw new InternalServerErrorException({
        code: 'S3_UPLOAD_FAILED',
        message: 'Failed to upload file to storage',
      });
    } finally {
      await this.removeTempFile(filePath);
    }

    const record = this.filesRepository.create({
      ownerId: user.id,
      originalName,
      encryptedName,
      s3Key,
      sizeBytes: String(file.size),
      mimeType: file.mimetype,
      checksumSha256: checksum,
    });

    try {
      return await this.filesRepository.save(record);
    } catch (error) {
      await this.safeDeleteS3Object(s3Key);
      if (this.isForeignKeyError(error)) {
        throw new ForbiddenException({
          code: 'USER_NOT_FOUND',
          message: 'Owner not found or already deleted',
        });
      }
      this.logger.error('Failed to persist file metadata', String(error));
      throw new InternalServerErrorException({
        code: 'FILE_METADATA_SAVE_FAILED',
        message: 'Failed to save file metadata',
      });
    }
  }

  private encryptFileName(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  private async getOwnedFileOrThrow(fileId: string, user: User) {
    const file = await this.filesRepository.findOne({ where: { id: fileId } });
    if (!file || file.status === FileUploadStatus.SOFT_DELETED) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'File not found',
      });
    }

    const isOwner = file.ownerId === user.id;
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_RESOURCE',
        message: 'You do not have access to this file',
      });
    }
    return file;
  }

  private toResponseDto(file: FileUpload): FileUploadResponseDto {
    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      status: file.status,
      createdAt: file.createdAt.toISOString(),
      ownerId: file.ownerId,
    };
  }

  private async ensureUserExists(userId: string) {
    const existing = await this.usersService.findOneById(userId);
    if (!existing) {
      throw new ForbiddenException({
        code: 'USER_NOT_FOUND',
        message: 'Owner not found or already deleted',
      });
    }
  }

  private async computeChecksum(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    await new Promise<void>((resolve, reject) => {
      createReadStream(filePath)
        .on('data', (chunk) => hash.update(chunk))
        .on('end', () => resolve())
        .on('error', (error) => reject(error));
    });
    return hash.digest('hex');
  }

  private async uploadStreamToS3(options: {
    filePath: string;
    s3Key: string;
    mimeType: string;
    contentLength: number;
  }) {
    const { filePath, s3Key, mimeType, contentLength } = options;
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: s3Key,
        Body: createReadStream(filePath),
        ContentType: mimeType,
        ContentLength: contentLength,
        ServerSideEncryption: 'AES256',
      },
      partSize: this.uploadPartSize,
      queueSize: this.uploadQueueSize,
    });
    await upload.done();
  }

  private async removeTempFile(filePath: string) {
    try {
      await fsPromises.unlink(filePath);
    } catch (error) {
      this.logger.warn('Failed to remove temp upload file', String(error));
    }
  }

  private async safeDeleteS3Object(key: string) {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      this.logger.warn('Failed to cleanup orphaned S3 object', String(error));
    }
  }

  private isForeignKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === '23503'
    );
  }

  private createListQueryBuilder(query: ListFilesQueryDto) {
    const qb = this.filesRepository
      .createQueryBuilder('file')
      .where('file.status = :status', { status: FileUploadStatus.ACTIVE });

    if (query.q) {
      qb.andWhere('file.originalName ILIKE :q', { q: `%${query.q}%` });
    }
    if (query.from) {
      const fromDate = new Date(query.from);
      if (!isNaN(fromDate.getTime())) {
        qb.andWhere('file.createdAt >= :from', {
          from: fromDate.toISOString(),
        });
      }
    }
    if (query.to) {
      const toDate = new Date(query.to);
      if (!isNaN(toDate.getTime())) {
        qb.andWhere('file.createdAt <= :to', { to: toDate.toISOString() });
      }
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    qb.orderBy('file.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    return { qb, page, limit };
  }
}
