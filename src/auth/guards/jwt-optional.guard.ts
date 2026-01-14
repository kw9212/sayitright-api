import { AccessTokenPayload } from '../../common/types/jwt-payload.type';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';

type AuthedRequest = Request & { user?: AccessTokenPayload };

@Injectable()
export class JwtOptionalGuard implements CanActivate {
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

      if (payload.typ !== 'access') {
        req.user = undefined;
        return true;
      }

      req.user = payload;
      return true;
    } catch {
      req.user = undefined;
      return true;
    }
  }
}
