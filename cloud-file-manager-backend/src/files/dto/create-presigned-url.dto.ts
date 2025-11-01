import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreatePresignedUrlDto {
  @ApiProperty({ example: 'health_data.csv' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ example: 'text/csv' })
  @IsString()
  @IsNotEmpty()
  contentType: string;

  @ApiProperty({ example: 10240, description: 'File size in bytes' })
  @IsNumber()
  size: number;
}
