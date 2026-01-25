import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthRequest } from '../types/auth-request.type';

/**
 * IP 기반 rate limiting (게스트 전용)
 * 간단한 인메모리 구현
 */

interface RateLimitRecord {
  count: number;
  resetAt: number; // timestamp
}

@Injectable()
export class IpRateLimitGuard implements CanActivate {
  private readonly limits = new Map<string, RateLimitRecord>();
  private readonly MAX_REQUESTS = 3; // 일일 3회
  private readonly WINDOW_MS = 24 * 60 * 60 * 1000; // 24시간

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();

    // 로그인한 사용자는 IP 제한 적용하지 않음
    if (request.user?.sub) {
      return true;
    }

    const ip = this.getClientIp(request);

    if (!ip) {
      throw new HttpException('IP를 확인할 수 없습니다', HttpStatus.BAD_REQUEST);
    }

    const now = Date.now();
    const record = this.limits.get(ip);

    // 기록이 없거나 윈도우가 만료된 경우
    if (!record || now > record.resetAt) {
      this.limits.set(ip, {
        count: 1,
        resetAt: now + this.WINDOW_MS,
      });
      return true;
    }

    // 한도 초과
    if (record.count >= this.MAX_REQUESTS) {
      throw new HttpException(
        '일일 게스트 이메일 생성 한도를 초과했습니다. 회원가입 후 무제한으로 사용하세요.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 카운트 증가
    record.count += 1;
    this.limits.set(ip, record);

    return true;
  }

  private getClientIp(request: Request): string | undefined {
    // Proxy를 통한 경우 X-Forwarded-For 헤더 확인
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(',')[0].trim();
    }

    // X-Real-IP 헤더 확인
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // 직접 연결된 경우
    return request.ip || request.socket.remoteAddress;
  }

  // 주기적으로 오래된 레코드 정리 (선택사항)
  clearExpiredRecords(): void {
    const now = Date.now();
    for (const [ip, record] of this.limits.entries()) {
      if (now > record.resetAt) {
        this.limits.delete(ip);
      }
    }
  }
}
