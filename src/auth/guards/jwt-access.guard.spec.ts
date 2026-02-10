/**
 * JwtAccessGuard 테스트
 *
 * JWT 액세스 토큰 검증 가드 테스트
 * - Authorization 헤더 검증
 * - Bearer 토큰 형식 확인
 * - JWT 토큰 검증
 * - 토큰 타입 확인 (access만 허용)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAccessGuard } from './jwt-access.guard';
import { createMockJwtService } from '../../test/test-helpers';

describe('JwtAccessGuard', () => {
  let guard: JwtAccessGuard;
  let jwtService: jest.Mocked<JwtService>;

  const createMockExecutionContext = (
    headers: Record<string, string> = {},
    user?: { sub: string; email: string },
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          user,
        }),
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const mockJwtService = createMockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAccessGuard,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    guard = module.get<JwtAccessGuard>(JwtAccessGuard);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('토큰 검증', () => {
    it('유효한 액세스 토큰이면 통과해야 한다', async () => {
      // Given: 유효한 Bearer 토큰
      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token-123',
      });

      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        typ: 'access' as const,
      };
      jwtService.verifyAsync.mockResolvedValue(payload as any);

      // When: 가드 실행
      const result = await guard.canActivate(context);

      // Then: 통과
      expect(result).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token-123', expect.any(Object));
    });

    it('Authorization 헤더가 없으면 UnauthorizedException을 던진다', async () => {
      // Given: Authorization 헤더 없음
      const context = createMockExecutionContext({});

      // When & Then: UnauthorizedException 발생
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Invalid credentials');
    });

    it('Bearer 형식이 아니면 UnauthorizedException을 던진다', async () => {
      // Given: 잘못된 형식
      const context = createMockExecutionContext({
        authorization: 'Basic some-token',
      });

      // When & Then: UnauthorizedException 발생
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('토큰이 비어있으면 UnauthorizedException을 던진다', async () => {
      // Given: Bearer만 있고 토큰 없음
      const context = createMockExecutionContext({
        authorization: 'Bearer ',
      });

      // When & Then: UnauthorizedException 발생
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('토큰 검증에 실패하면 UnauthorizedException을 던진다', async () => {
      // Given: 유효하지 않은 토큰
      const context = createMockExecutionContext({
        authorization: 'Bearer invalid-token',
      });
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      // When & Then: UnauthorizedException 발생
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('토큰 타입이 access가 아니면 UnauthorizedException을 던진다', async () => {
      // Given: refresh 토큰
      const context = createMockExecutionContext({
        authorization: 'Bearer refresh-token',
      });

      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        typ: 'refresh' as const,
      };
      jwtService.verifyAsync.mockResolvedValue(payload as any);

      // When & Then: UnauthorizedException 발생
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('검증 성공 시 request.user에 payload를 설정해야 한다', async () => {
      // Given: 유효한 토큰
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-token',
        },
        user: undefined,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as any;

      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        typ: 'access' as const,
      };
      jwtService.verifyAsync.mockResolvedValue(payload as any);

      // When: 가드 실행
      await guard.canActivate(context);

      // Then: request.user에 payload 설정됨
      expect(mockRequest.user).toEqual(payload);
    });
  });
});
