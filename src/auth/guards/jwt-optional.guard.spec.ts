/**
 * JwtOptionalGuard 테스트
 *
 * 선택적 JWT 인증 가드 테스트
 * - 토큰 있으면 검증 후 user 설정
 * - 토큰 없으면 통과 (user는 undefined)
 * - 잘못된 토큰이어도 통과 (user는 undefined)
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtOptionalGuard } from './jwt-optional.guard';
import { createMockJwtService } from '../../test/test-helpers';

describe('JwtOptionalGuard', () => {
  let guard: JwtOptionalGuard;
  let jwtService: jest.Mocked<JwtService>;

  const createMockExecutionContext = (
    headers: Record<string, string> = {},
  ): {
    context: ExecutionContext;
    request: { headers: Record<string, string>; user?: unknown };
  } => {
    const request = { headers, user: undefined };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
    return { context, request };
  };

  beforeEach(async () => {
    jwtService = createMockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtOptionalGuard, { provide: JwtService, useValue: jwtService }],
    }).compile();

    guard = module.get<JwtOptionalGuard>(JwtOptionalGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('토큰 있는 경우', () => {
    it('유효한 토큰이면 user를 설정하고 통과해야 한다', async () => {
      // Given: 유효한 토큰
      const payload = { sub: 'user-123', email: 'test@example.com', typ: 'access' };
      const { context, request } = createMockExecutionContext({
        authorization: 'Bearer valid-token-123',
      });

      jwtService.verifyAsync.mockResolvedValue(payload);

      // When: 가드 실행
      const result = await guard.canActivate(context);

      // Then: 통과하고 user 설정됨
      expect(result).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token-123', expect.any(Object));
      expect(request.user).toEqual(payload);
    });

    it('잘못된 토큰 타입이면 user를 undefined로 설정하고 통과해야 한다', async () => {
      // Given: refresh 토큰 (access가 아님)
      const payload = { sub: 'user-123', email: 'test@example.com', typ: 'refresh' };
      const { context, request } = createMockExecutionContext({
        authorization: 'Bearer refresh-token',
      });

      jwtService.verifyAsync.mockResolvedValue(payload);

      // When: 가드 실행
      const result = await guard.canActivate(context);

      // Then: 통과하지만 user는 undefined
      expect(result).toBe(true);
      expect(request.user).toBeUndefined();
    });

    it('만료된 토큰이면 user를 undefined로 설정하고 통과해야 한다', async () => {
      // Given: 만료된 토큰
      const { context, request } = createMockExecutionContext({
        authorization: 'Bearer expired-token',
      });

      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      // When: 가드 실행
      const result = await guard.canActivate(context);

      // Then: 통과하지만 user는 undefined
      expect(result).toBe(true);
      expect(request.user).toBeUndefined();
    });

    it('잘못된 토큰이면 user를 undefined로 설정하고 통과해야 한다', async () => {
      // Given: 잘못된 토큰
      const { context, request } = createMockExecutionContext({
        authorization: 'Bearer invalid-token',
      });

      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

      // When: 가드 실행
      const result = await guard.canActivate(context);

      // Then: 통과하지만 user는 undefined
      expect(result).toBe(true);
      expect(request.user).toBeUndefined();
    });
  });

  describe('토큰 없는 경우', () => {
    it('Authorization 헤더가 없으면 user를 undefined로 설정하고 통과해야 한다', async () => {
      // Given: Authorization 헤더 없음
      const { context, request } = createMockExecutionContext({});

      // When: 가드 실행
      const result = await guard.canActivate(context);

      // Then: 통과하고 user는 undefined
      expect(result).toBe(true);
      expect(request.user).toBeUndefined();
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('Bearer 없이 토큰만 있으면 user를 undefined로 설정하고 통과해야 한다', async () => {
      // Given: Bearer 없음
      const { context, request } = createMockExecutionContext({
        authorization: 'just-a-token',
      });

      // When: 가드 실행
      const result = await guard.canActivate(context);

      // Then: 통과하고 user는 undefined
      expect(result).toBe(true);
      expect(request.user).toBeUndefined();
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('Bearer 뒤에 토큰이 없으면 user를 undefined로 설정하고 통과해야 한다', async () => {
      // Given: Bearer 뒤에 빈 문자열
      const { context, request } = createMockExecutionContext({
        authorization: 'Bearer ',
      });

      // When: 가드 실행
      const result = await guard.canActivate(context);

      // Then: 통과하고 user는 undefined
      expect(result).toBe(true);
      expect(request.user).toBeUndefined();
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('빈 Authorization 헤더면 user를 undefined로 설정하고 통과해야 한다', async () => {
      // Given: 빈 Authorization
      const { context, request } = createMockExecutionContext({
        authorization: '',
      });

      // When: 가드 실행
      const result = await guard.canActivate(context);

      // Then: 통과하고 user는 undefined
      expect(result).toBe(true);
      expect(request.user).toBeUndefined();
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });
  });
});
