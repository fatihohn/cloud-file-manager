import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_COMPLEXITY_REGEX } from '../../users/entity/user.entity';

export class AuthCredentialsDto {
  @IsEmail()
  @ApiProperty({
    example: 'johndoe@test.com',
    description: 'User email',
    type: 'string',
    format: 'email',
  })
  email: string;

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
}
