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

export enum FileUploadStatus {
  ACTIVE = 'ACTIVE',
  SOFT_DELETED = 'SOFT_DELETED',
}

@Entity('file_uploads')
export class FileUpload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ name: 'encrypted_name' })
  encryptedName: string;

  @Column({ name: 's3_key', unique: true })
  s3Key: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'checksum_sha256', type: 'varchar', nullable: true })
  checksumSha256?: string | null;

  @Column({
    type: 'enum',
    enum: FileUploadStatus,
    default: FileUploadStatus.ACTIVE,
  })
  status: FileUploadStatus;

  @Column({ name: 'soft_deleted_at', type: 'timestamptz', nullable: true })
  softDeletedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
