import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { AUTH_ERRORS } from '../../auth/auth.errors';

@Injectable()
export class FilesUploadAuthMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return this.reject(res);
    }

    const [, token] = authHeader.split(' ');
    try {
      const payload = await this.jwtService.verifyAsync(token);
      if (!req.user) {
        (req as Request & { user?: unknown }).user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        };
      }
      return next();
    } catch {
      return this.reject(res);
    }
  }

  private reject(res: Response) {
    return res.status(HttpStatus.UNAUTHORIZED).json({
      statusCode: HttpStatus.UNAUTHORIZED,
      ...AUTH_ERRORS.INVALID_CREDENTIALS,
    });
  }
}
