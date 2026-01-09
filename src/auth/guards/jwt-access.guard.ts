import { AccessTokenPayload } from './../../common/types/jwt-payload-type';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';

type AuthedRequest = Request & { user?: AccessTokenPayload };

@Injectable()
export class JwtAccessGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = auth.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException('Invalid credentials');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: process.env.JWT_SECRET ?? 'dev-secret',
      });
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid credentials');
    }

    req.user = payload;
    return true;
  }
}
