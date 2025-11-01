import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlResponseDto {
  @ApiProperty({
    description: 'The URL to which the client should POST the form data.',
    example: 'https://<bucket-name>.s3.<region>.amazonaws.com/',
  })
  url: string;

  @ApiProperty({
    description:
      'A dictionary of form fields that must be included in the POST request.',
    example: {
      key: 'path/to/your/object.jpg',
      'Content-Type': 'image/jpeg',
      AWSAccessKeyId: 'YOUR_ACCESS_KEY_ID',
      policy: 'YOUR_POLICY_DOCUMENT_BASE64_ENCODED',
      signature: 'YOUR_SIGNATURE',
    },
  })
  fields: Record<string, string>;
}
