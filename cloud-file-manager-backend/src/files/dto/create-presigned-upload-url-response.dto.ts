import { ApiProperty } from '@nestjs/swagger';

export class CreatePresignedUploadUrlResponseDto {
  @ApiProperty()
  fileId: string;

  @ApiProperty()
  url: string;

  @ApiProperty()
  fields: Record<string, string>;
}
