/**
 * IpRateLimitGuard 테스트
 *
 * IP 기반 요청 제한 가드 테스트
 * - 게스트 사용자 IP 제한 (일일 3회)
 * - 로그인 사용자는 제한 없음
 * - IP 추출 로직 (X-Forwarded-For, X-Real-IP)
 * - 만료된 레코드 정리
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { IpRateLimitGuard } from './ip-rate-limit.guard';

describe('IpRateLimitGuard', () => {
  let guard: IpRateLimitGuard;

  const createMockExecutionContext = (
    headers: Record<string, string> = {},
    user?: { sub: string },
    ip?: string,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          user,
          ip,
          socket: {
            remoteAddress: '127.0.0.1',
          },
        }),
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IpRateLimitGuard],
    }).compile();

    guard = module.get<IpRateLimitGuard>(IpRateLimitGuard);
  });

  afterEach(() => {
    // 각 테스트 후 내부 Map 초기화
    guard.clearExpiredRecords();
    guard['limits'].clear();
  });

  describe('로그인 사용자', () => {
    it('로그인한 사용자는 IP 제한이 적용되지 않아야 한다', () => {
      // Given: 로그인한 사용자
      const context = createMockExecutionContext({}, { sub: 'user-123' }, '1.2.3.4');

      // When: 가드 실행
      const result = guard.canActivate(context);

      // Then: 즉시 통과
      expect(result).toBe(true);
    });
  });

  describe('게스트 사용자 (IP 제한)', () => {
    it('첫 요청은 허용해야 한다', () => {
      // Given: 첫 요청
      const context = createMockExecutionContext({}, undefined, '1.2.3.4');

      // When: 가드 실행
      const result = guard.canActivate(context);

      // Then: 통과 (1/3)
      expect(result).toBe(true);
    });

    it('3회까지는 허용해야 한다', () => {
      // Given: 동일 IP에서 3회 요청
      const context = createMockExecutionContext({}, undefined, '1.2.3.4');

      // When: 3회 요청
      const result1 = guard.canActivate(context);
      const result2 = guard.canActivate(context);
      const result3 = guard.canActivate(context);

      // Then: 모두 통과
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it('4회째 요청은 거부해야 한다', () => {
      // Given: 동일 IP에서 3회 요청 완료
      const context = createMockExecutionContext({}, undefined, '1.2.3.4');
      guard.canActivate(context); // 1회
      guard.canActivate(context); // 2회
      guard.canActivate(context); // 3회

      // When & Then: 4회째 요청은 거부
      expect(() => guard.canActivate(context)).toThrow(HttpException);
      expect(() => guard.canActivate(context)).toThrow(
        '일일 게스트 이메일 생성 한도를 초과했습니다',
      );
    });

    it('다른 IP는 독립적으로 카운트되어야 한다', () => {
      // Given: 두 개의 다른 IP
      const context1 = createMockExecutionContext({}, undefined, '1.2.3.4');
      const context2 = createMockExecutionContext({}, undefined, '5.6.7.8');

      // When: 각각 요청
      guard.canActivate(context1);
      guard.canActivate(context1);
      guard.canActivate(context1);

      // Then: IP2는 아직 제한 안 걸림
      const result = guard.canActivate(context2);
      expect(result).toBe(true);
    });
  });

  describe('IP 추출 로직', () => {
    it('X-Forwarded-For 헤더를 우선적으로 사용해야 한다', () => {
      // Given: X-Forwarded-For 헤더
      const context = createMockExecutionContext({
        'x-forwarded-for': '10.0.0.1, 192.168.1.1',
      });

      // When: 가드 실행
      const result = guard.canActivate(context);

      // Then: 첫 번째 IP 사용
      expect(result).toBe(true);
    });

    it('X-Real-IP 헤더를 사용할 수 있어야 한다', () => {
      // Given: X-Real-IP 헤더
      const context = createMockExecutionContext({
        'x-real-ip': '10.0.0.2',
      });

      // When: 가드 실행
      const result = guard.canActivate(context);

      // Then: 통과
      expect(result).toBe(true);
    });

    it('request.ip를 fallback으로 사용해야 한다', () => {
      // Given: request.ip만 있음
      const context = createMockExecutionContext({}, undefined, '127.0.0.1');

      // When: 가드 실행
      const result = guard.canActivate(context);

      // Then: 통과
      expect(result).toBe(true);
    });

    it('IP를 확인할 수 없으면 HttpException을 던진다', () => {
      // Given: IP 정보 없음
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
            user: undefined,
            socket: {},
          }),
        }),
      } as ExecutionContext;

      // When & Then: HttpException 발생
      expect(() => guard.canActivate(context)).toThrow(HttpException);
      expect(() => guard.canActivate(context)).toThrow('IP를 확인할 수 없습니다');
    });
  });

  describe('만료된 레코드 정리 (clearExpiredRecords)', () => {
    it('만료된 레코드를 정리해야 한다', () => {
      // Given: 만료된 레코드 생성
      const pastTime = Date.now() - 25 * 60 * 60 * 1000; // 25시간 전
      guard['limits'].set('expired-ip', {
        count: 3,
        resetAt: pastTime,
      });
      guard['limits'].set('valid-ip', {
        count: 2,
        resetAt: Date.now() + 60 * 60 * 1000, // 1시간 후
      });

      // When: 정리 실행
      guard.clearExpiredRecords();

      // Then: 만료된 레코드만 삭제됨
      expect(guard['limits'].has('expired-ip')).toBe(false);
      expect(guard['limits'].has('valid-ip')).toBe(true);
    });

    it('모든 레코드가 유효하면 삭제하지 않아야 한다', () => {
      // Given: 유효한 레코드만
      guard['limits'].set('valid-ip-1', {
        count: 1,
        resetAt: Date.now() + 60 * 60 * 1000,
      });
      guard['limits'].set('valid-ip-2', {
        count: 2,
        resetAt: Date.now() + 120 * 60 * 1000,
      });

      // When: 정리 실행
      guard.clearExpiredRecords();

      // Then: 레코드 유지됨
      expect(guard['limits'].size).toBe(2);
    });

    it('빈 Map에서도 에러 없이 실행되어야 한다', () => {
      // Given: 빈 Map
      guard['limits'].clear();

      // When & Then: 에러 없이 실행
      expect(() => guard.clearExpiredRecords()).not.toThrow();
    });
  });
});
