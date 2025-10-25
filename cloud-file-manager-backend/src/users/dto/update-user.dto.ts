import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

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
  @MinLength(8)
  @IsOptional()
  @ApiPropertyOptional({
    description: 'User password',
    type: 'string',
    minLength: 8,
    nullable: true,
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
