import {
  BadRequestException,
  Injectable,
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
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createCipheriv, randomBytes } from 'crypto';
import { LoggerService } from '../logger/logger.service';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { FILE_ERRORS, FILE_RESPONSES } from './files.errors';
import { CreatePresignedUrlDto } from './dto/create-presigned-url.dto';
import { CreatePresignedUploadUrlResponseDto } from './dto/create-presigned-upload-url-response.dto';

@Injectable()
export class FilesService {
  private readonly bucket: string;
  private readonly maxUploadBytes: number;
  private readonly downloadUrlTtlSeconds: number;
  private readonly encryptionKey: Buffer;
  private readonly allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel'];

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
      this.configService.get<string>('FILES_DOWNLOAD_URL_TTL_SECONDS', '300'),
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

  async createPresignedUploadUrls(
    user: User,
    createDtos: CreatePresignedUrlDto[],
  ): Promise<CreatePresignedUploadUrlResponseDto[]> {
    const response: CreatePresignedUploadUrlResponseDto[] = [];

    for (const dto of createDtos) {
      this.validateFile({ mimetype: dto.contentType, size: dto.size });

      const fileId = randomUUID();
      const s3Key = `${user.id}/${fileId}/${dto.fileName}`;

      const record = this.filesRepository.create({
        id: fileId,
        ownerId: user.id,
        originalName: dto.fileName,
        encryptedName: this.encryptFileName(dto.fileName),
        s3Key,
        mimeType: dto.contentType,
        status: FileUploadStatus.PENDING,
        sizeBytes: '0', // Will be updated by worker
      });
      await this.filesRepository.save(record);

      const { url, fields } = await createPresignedPost(this.s3, {
        Bucket: this.bucket,
        Key: s3Key,
        Conditions: [
          ['content-length-range', 0, this.maxUploadBytes],
          { 'Content-Type': dto.contentType },
        ],
        Fields: {
          'Content-Type': dto.contentType,
        },
        Expires: this.downloadUrlTtlSeconds,
      });

      response.push({ fileId, url, fields });
    }

    return response;
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

  async getFileById(
    fileId: string,
    user: User,
  ): Promise<FileUploadResponseDto> {
    const file = await this.getOwnedFileOrThrow(fileId, user);
    return this.toResponseDto(file);
  }

  async generateDownloadUrl(
    fileId: string,
    user: User,
  ): Promise<{ url: string; expiresAt: string }> {
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
      ...FILE_RESPONSES.FILE_SOFT_DELETED,
      fileId: file.id,
    };
  }

  private validateFile(file: { mimetype: string; size?: number }) {
    if (file.size && file.size > this.maxUploadBytes) {
      throw new PayloadTooLargeException({
        code: FILE_ERRORS.UPLOAD_TOO_LARGE.code,
        message: FILE_ERRORS.UPLOAD_TOO_LARGE.message(this.maxUploadBytes),
      });
    }
    const mimeType = file.mimetype ?? '';
    if (!this.allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException(FILE_ERRORS.UNSUPPORTED_FILE_TYPE);
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

    // For security, throw NotFound for both missing files and unauthorized access
    if (!file || file.status === FileUploadStatus.SOFT_DELETED) {
      throw new NotFoundException(FILE_ERRORS.FILE_NOT_FOUND);
    }

    const isOwner = file.ownerId === user.id;
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new NotFoundException(FILE_ERRORS.FILE_NOT_FOUND);
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
