import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

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
  @MinLength(8)
  @ApiProperty({
    description: 'User password',
    type: 'string',
    minLength: 8,
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
