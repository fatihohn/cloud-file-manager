import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { PASSWORD_COMPLEXITY_REGEX } from '../entity/user.entity';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  @ApiPropertyOptional({
    example: 'johndoe@test.com',
    description: 'User email',
    type: 'string',
    format: 'email',
    nullable: true,
  })
  email?: string;

  @IsString()
  @IsOptional()
  @MinLength(12, {
    message: 'password must be at least 12 characters long',
  })
  @Matches(PASSWORD_COMPLEXITY_REGEX, {
    message: 'password must include upper/lowercase, number, symbol',
  })
  @ApiProperty({
    description: 'User password',
    type: 'string',
    minLength: 12,
    example: 'Sup3rSecure!',
  })
  password?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'User name',
    type: 'string',
    nullable: true,
  })
  name?: string;

  @IsOptional()
  currentHashedRefreshToken?: string | null;
}
