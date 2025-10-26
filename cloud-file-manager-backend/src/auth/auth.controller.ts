import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { AuthService } from './auth.service';
import { JwtRefreshGuard } from './guard/jwt-refresh.guard';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  logout(@Req() req) {
    return this.authService.logout(req.user.id as string);
  }

  @Post('/refresh')
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token' })
  refreshTokens(@Req() req) {
    const userId = req.user.id as string;
    const refreshToken = req.user.refreshToken as string;
    return this.authService.refreshTokens(userId, refreshToken);
  }
}
