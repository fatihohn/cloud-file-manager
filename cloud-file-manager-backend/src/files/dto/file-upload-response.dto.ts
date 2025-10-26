import { ApiProperty } from '@nestjs/swagger';
import { FileUploadStatus } from '../entities/file-upload.entity';

export class FileUploadResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'File identifier',
    example: 'b1ac2a8e-9d0e-4cbb-994a-60cb90f76b1f',
  })
  id: string;

  @ApiProperty({
    description: 'Original filename provided by the user',
    example: 'health_data_small.csv',
  })
  originalName: string;

  @ApiProperty({
    description: 'Detected MIME type',
    example: 'text/csv',
  })
  mimeType: string;

  @ApiProperty({
    description: 'File size in bytes (string to avoid bigint overflow)',
    type: 'string',
    example: '10240',
  })
  sizeBytes: string;

  @ApiProperty({
    enum: FileUploadStatus,
    description: 'Current lifecycle state inside the platform',
  })
  status: FileUploadStatus;

  @ApiProperty({
    format: 'date-time',
    description: 'Creation timestamp (UTC)',
    example: '2025-01-01T12:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Owner identifier',
    example: '21c1ed5b-b2eb-4fd1-8d3b-63e7eb2f36a4',
  })
  ownerId: string;
}
