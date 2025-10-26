import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlResponseDto {
  @ApiProperty({ description: 'Temporary signed URL' })
  url: string;

  @ApiProperty({
    description: 'ISO timestamp when URL expires',
    format: 'date-time',
  })
  expiresAt: string;
}
