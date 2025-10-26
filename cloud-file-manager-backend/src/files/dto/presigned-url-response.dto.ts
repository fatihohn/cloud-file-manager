import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlResponseDto {
  @ApiProperty({
    description: 'Temporary signed URL',
    example:
      'https://bucket.s3.us-east-1.amazonaws.com/user/file?X-Amz-Expires=60&X-Amz-Signature=...',
  })
  url: string;

  @ApiProperty({
    description: 'ISO timestamp when URL expires',
    format: 'date-time',
    example: '2025-01-01T12:01:00.000Z',
  })
  expiresAt: string;
}
