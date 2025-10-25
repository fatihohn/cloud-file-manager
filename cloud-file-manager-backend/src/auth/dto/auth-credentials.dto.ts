import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @MinLength(8)
  @ApiProperty({
    description: 'User password',
    type: 'string',
    minLength: 8,
  })
  password: string;
}
