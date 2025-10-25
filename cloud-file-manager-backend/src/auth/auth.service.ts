import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../users/entity/user.entity';
import type { StringValue } from 'ms';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async _getTokens(userId: number, email: string, role: UserRole) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: this.configService.get<string>(
            'JWT_ACCESS_EXPIRATION',
          ) as StringValue,
        },
      ),
      this.jwtService.signAsync(
        { sub: userId },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>(
            'JWT_REFRESH_EXPIRATION',
          ) as StringValue,
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  private async _updateRefreshToken(userId: number, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.update(userId, {
      currentHashedRefreshToken: hashedRefreshToken,
    });

    console.log('Updated refresh token for user:', userId);
  }

  async signIn(
    authCredentialsDto: AuthCredentialsDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { email, password } = authCredentialsDto;
    const user = await this.usersService.findOneByEmail(email);

    if (user && (await bcrypt.compare(password, user.password))) {
      const tokens = await this._getTokens(user.id, user.email, user.role);

      await this._updateRefreshToken(user.id, tokens.refreshToken);
      return tokens;
    } else {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async logout(userId: number): Promise<{ message: string }> {
    await this.usersService.update(userId, { currentHashedRefreshToken: null });
    return { message: 'Logged out.' };
  }

  async refreshTokens(userId: number, refreshToken: string) {
    const user = await this.usersService.findOneById(userId);
    if (!user?.currentHashedRefreshToken) {
      throw new UnauthorizedException('Invalid credentials: no refresh token');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.currentHashedRefreshToken,
    );

    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid credentials: token mismatch');
    }

    const tokens = await this._getTokens(user.id, user.email, user.role);
    await this._updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }
}
