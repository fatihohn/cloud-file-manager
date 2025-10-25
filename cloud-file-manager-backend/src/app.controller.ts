import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { CreateUserDto } from './users/dto/create-user.dto';
import { UsersService } from './users/users.service';
import { AuthCredentialsDto } from './auth/dto/auth-credentials.dto';
import { AuthService } from './auth/auth.service';
import { ApiExcludeEndpoint, ApiOperation } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @ApiExcludeEndpoint()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('/signup')
  @ApiOperation({ summary: 'User Registration' })
  async signup(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  @Post('/signin')
  @ApiOperation({ summary: 'User Signin' })
  async signin(@Body() authCredentialsDto: AuthCredentialsDto) {
    const tokens = await this.authService.signIn(authCredentialsDto);
    return tokens;
  }
}
