import { AccessTokenPayload } from '../../common/types/jwt-payload.type';
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';

type AuthedRequest = Request & { user?: AccessTokenPayload };

@Injectable()
export class JwtOptionalGuard implements CanActivate {
  private readonly logger = new Logger(JwtOptionalGuard.name);

  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      req.user = undefined;
      return true;
    }

    const token = auth.slice('Bearer '.length).trim();
    if (!token) {
      req.user = undefined;
      return true;
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: process.env.JWT_SECRET ?? 'dev-secret',
      });

      if ((payload as { typ?: string }).typ !== 'access') {
        this.logger.warn(`잘못된 토큰 타입: ${(payload as { typ?: string }).typ}`);
        req.user = undefined;
        return true;
      }

      req.user = payload;
      return true;
    } catch (error) {
      if (error instanceof Error && !error.message.includes('jwt expired')) {
        this.logger.warn('JWT 검증 실패:', error.message);
      }
      req.user = undefined;
      return true;
    }
  }
}
