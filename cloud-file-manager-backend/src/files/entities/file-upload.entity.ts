import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entity/user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FileUploadStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SOFT_DELETED = 'SOFT_DELETED',
}

@Entity('file_uploads')
export class FileUpload {
  @ApiProperty({ format: 'uuid', description: 'Database identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', description: 'Owner user identifier' })
  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId: string;

  @ApiProperty({ type: () => User, description: 'Owning user relation' })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @ApiProperty({ description: 'Original filename' })
  @Column({ name: 'original_name' })
  originalName: string;

  @ApiProperty({ description: 'AES-256 encrypted filename stored in DB' })
  @Column({ name: 'encrypted_name' })
  encryptedName: string;

  @ApiProperty({ description: 'S3 object key', example: 'user-id/uuid' })
  @Column({ name: 's3_key', unique: true })
  s3Key: string;

  @ApiProperty({ description: 'File size in bytes', type: 'string' })
  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: string;

  @ApiProperty({ description: 'Stored MIME type' })
  @Column({ name: 'mime_type' })
  mimeType: string;

  @ApiProperty({ enum: FileUploadStatus, default: FileUploadStatus.ACTIVE })
  @Column({
    type: 'enum',
    enum: FileUploadStatus,
    default: FileUploadStatus.ACTIVE,
  })
  status: FileUploadStatus;

  @ApiPropertyOptional({ description: 'Timestamp when file was soft deleted' })
  @Column({ name: 'soft_deleted_at', type: 'timestamptz', nullable: true })
  softDeletedAt?: Date | null;

  @ApiProperty({ format: 'date-time' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
