import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { PASSWORD_COMPLEXITY_REGEX } from '../entity/user.entity';

export class CreateUserDto {
  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({
    example: 'johndoe@test.com',
    description: 'User email',
    type: 'string',
    format: 'email',
  })
  email: string;

  @IsNotEmpty()
  @IsString()
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
  password: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    example: 'John Doe',
    description: 'User name',
    type: 'string',
  })
  name: string;
}
