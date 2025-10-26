import { ApiProperty } from '@nestjs/swagger';
import { FileUploadStatus } from '../entities/file-upload.entity';

export class FileUploadResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty({ description: 'File size in bytes', type: 'string' })
  sizeBytes: string;

  @ApiProperty({ enum: FileUploadStatus })
  status: FileUploadStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;
}
