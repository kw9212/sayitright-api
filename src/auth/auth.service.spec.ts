/**
 * AuthService 테스트
 *
 * 인증 서비스의 핵심 로직 테스트:
 * - 회원가입 (signup)
 * - 로그인 (login)
 * - 토큰 갱신 (refresh)
 * - 로그아웃 (logout, logoutAll)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { REDIS } from '../redis/redis.module';
import {
  createMockRedis,
  createMockJwtService,
  createTestUser,
  expectToThrowAsync,
} from '../test/test-helpers';

// bcrypt mock
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(async () => {
    // Mock 객체 생성
    redis = createMockRedis();
    const mockJwtService = createMockJwtService();
    const mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      createLocalUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: REDIS,
          useValue: redis,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('회원가입 (signup)', () => {
    const signupDto = {
      email: 'newuser@example.com',
      password: 'password123',
      username: 'newuser',
    };

    it('정상적으로 회원가입이 완료되어야 한다', async () => {
      // Given: 중복된 이메일이 없고, 회원가입 준비가 완료됨
      usersService.findByEmail.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);

      const newUser = createTestUser({
        id: 'new-user-id',
        email: signupDto.email,
        username: signupDto.username,
      });
      usersService.createLocalUser.mockResolvedValue(newUser);

      jwtService.signAsync.mockResolvedValue('access-token-123');

      // When: 회원가입 요청
      const result = await service.signup(signupDto);

      // Then: 액세스 토큰이 반환되고, 비밀번호가 해시되어 저장됨
      expect(result).toEqual({ accessToken: 'access-token-123' });
      expect(usersService.findByEmail).toHaveBeenCalledWith(signupDto.email);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(signupDto.password, 10);
      expect(usersService.createLocalUser).toHaveBeenCalledWith({
        email: signupDto.email,
        passwordHash: 'hashed-password',
        username: signupDto.username,
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: newUser.id, email: newUser.email, typ: 'access' },
        { expiresIn: '30m' },
      );
    });

    it('이미 존재하는 이메일인 경우 ConflictException을 던진다', async () => {
      // Given: 이미 존재하는 사용자
      const existingUser = createTestUser({ email: signupDto.email });
      usersService.findByEmail.mockResolvedValue(existingUser);

      // When & Then: ConflictException 발생
      await expectToThrowAsync(
        () => service.signup(signupDto),
        ConflictException,
        'Email already in use',
      );

      expect(usersService.findByEmail).toHaveBeenCalledWith(signupDto.email);
      expect(usersService.createLocalUser).not.toHaveBeenCalled();
    });
  });

  describe('로그인 (login)', () => {
    const loginDto = {
      email: 'user@example.com',
      password: 'password123',
    };

    it('정상적으로 로그인이 완료되어야 한다', async () => {
      // Given: 유효한 사용자와 비밀번호
      const user = createTestUser({
        email: loginDto.email,
        passwordHash: 'hashed-password',
      });
      usersService.findByEmail.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      
      jwtService.signAsync
        .mockResolvedValueOnce('access-token-123')
        .mockResolvedValueOnce('refresh-token-456');
      
      redis.set.mockResolvedValue('OK' as never);

      // When: 로그인 요청
      const result = await service.login(loginDto);

      // Then: 액세스 토큰과 리프레시 토큰이 반환됨
      expect(result).toMatchObject({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
      });
      expect(usersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(loginDto.password, user.passwordHash);
      expect(redis.set).toHaveBeenCalled(); // 리프레시 토큰 세션 저장
    });

    it('존재하지 않는 이메일인 경우 UnauthorizedException을 던진다', async () => {
      // Given: 존재하지 않는 사용자
      usersService.findByEmail.mockResolvedValue(null);

      // When & Then: UnauthorizedException 발생
      await expectToThrowAsync(
        () => service.login(loginDto),
        UnauthorizedException,
        'Invalid credentials',
      );

      expect(usersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('passwordHash가 없는 경우 (소셜 로그인 유저) UnauthorizedException을 던진다', async () => {
      // Given: 소셜 로그인으로 가입한 사용자 (passwordHash 없음)
      const socialUser = createTestUser({
        email: loginDto.email,
        passwordHash: null,
        authProvider: 'google',
      });
      usersService.findByEmail.mockResolvedValue(socialUser);

      // When & Then: UnauthorizedException 발생
      await expectToThrowAsync(
        () => service.login(loginDto),
        UnauthorizedException,
        'Invalid credentials',
      );

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('비밀번호가 일치하지 않으면 UnauthorizedException을 던진다', async () => {
      // Given: 유효한 사용자이지만 비밀번호 불일치
      const user = createTestUser({
        email: loginDto.email,
        passwordHash: 'hashed-password',
      });
      usersService.findByEmail.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      // When & Then: UnauthorizedException 발생
      await expectToThrowAsync(
        () => service.login(loginDto),
        UnauthorizedException,
        'Invalid credentials',
      );

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(loginDto.password, user.passwordHash);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('토큰 갱신 (refresh)', () => {
    const validRefreshToken = 'valid-refresh-token';
    const mockPayload = {
      sub: 'user-id-123',
      email: 'user@example.com',
      typ: 'refresh' as const,
      jti: 'jti-uuid-123',
    };

    it('정상적으로 토큰을 갱신해야 한다', async () => {
      // Given: 유효한 리프레시 토큰과 세션
      jwtService.verifyAsync.mockResolvedValue(mockPayload as any);
      redis.get.mockResolvedValue('1'); // 세션 존재
      
      const user = createTestUser({ id: mockPayload.sub, email: mockPayload.email });
      usersService.findById.mockResolvedValue(user);
      
      redis.del.mockResolvedValue(1 as never);
      redis.set.mockResolvedValue('OK' as never);
      
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      // When: 토큰 갱신 요청
      const result = await service.refresh(validRefreshToken);

      // Then: 새로운 토큰 쌍이 반환됨
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(validRefreshToken, expect.any(Object));
      expect(redis.get).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalled();
    });

    it('토큰 타입이 refresh가 아니면 UnauthorizedException을 던진다', async () => {
      // Given: 액세스 토큰을 리프레시 엔드포인트에 사용
      const accessPayload = { ...mockPayload, typ: 'access' };
      jwtService.verifyAsync.mockResolvedValue(accessPayload as any);

      // When & Then: UnauthorizedException 발생
      await expectToThrowAsync(
        () => service.refresh(validRefreshToken),
        UnauthorizedException,
        'Invalid credentials',
      );
    });

    it('세션이 Redis에 없으면 UnauthorizedException을 던진다', async () => {
      // Given: 유효한 토큰이지만 세션이 만료됨
      jwtService.verifyAsync.mockResolvedValue(mockPayload as any);
      redis.get.mockResolvedValue(null); // 세션 없음

      // When & Then: UnauthorizedException 발생
      await expectToThrowAsync(
        () => service.refresh(validRefreshToken),
        UnauthorizedException,
        'Invalid credentials',
      );

      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('사용자가 존재하지 않으면 UnauthorizedException을 던진다', async () => {
      // Given: 유효한 토큰과 세션이지만 사용자가 삭제됨
      jwtService.verifyAsync.mockResolvedValue(mockPayload as any);
      redis.get.mockResolvedValue('1');
      usersService.findById.mockResolvedValue(null);

      // When & Then: UnauthorizedException 발생
      await expectToThrowAsync(
        () => service.refresh(validRefreshToken),
        UnauthorizedException,
        'Invalid credentials',
      );
    });
  });

  describe('로그아웃 (logout)', () => {
    const validRefreshToken = 'valid-refresh-token';
    const mockPayload = {
      sub: 'user-id-123',
      email: 'user@example.com',
      typ: 'refresh' as const,
      jti: 'jti-uuid-123',
    };

    it('정상적으로 로그아웃이 완료되어야 한다', async () => {
      // Given: 유효한 리프레시 토큰
      jwtService.verifyAsync.mockResolvedValue(mockPayload as any);
      redis.del.mockResolvedValue(1 as never);

      // When: 로그아웃 요청
      await service.logout(validRefreshToken);

      // Then: Redis에서 세션이 삭제됨
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        validRefreshToken,
        expect.any(Object),
      );
      expect(redis.del).toHaveBeenCalled();
    });

    it('유효하지 않은 토큰이어도 에러를 던지지 않는다 (조용히 실패)', async () => {
      // Given: 유효하지 않은 토큰
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      // When & Then: 에러가 발생하지 않음
      await expect(service.logout(validRefreshToken)).resolves.not.toThrow();
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('토큰 타입이 refresh가 아니어도 에러를 던지지 않는다', async () => {
      // Given: 액세스 토큰
      const accessPayload = { ...mockPayload, typ: 'access' };
      jwtService.verifyAsync.mockResolvedValue(accessPayload as any);

      // When & Then: 에러가 발생하지 않음 (단, Redis 삭제도 안 됨)
      await expect(service.logout(validRefreshToken)).resolves.not.toThrow();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('전체 로그아웃 (logoutAll)', () => {
    const validRefreshToken = 'valid-refresh-token';
    const mockPayload = {
      sub: 'user-id-123',
      email: 'user@example.com',
      typ: 'refresh' as const,
      jti: 'jti-uuid-123',
    };

    it('해당 사용자의 모든 세션을 삭제해야 한다', async () => {
      // Given: 유효한 리프레시 토큰과 여러 세션
      jwtService.verifyAsync.mockResolvedValue(mockPayload as any);
      
      const mockStream = {
        on: jest.fn((event: string, handler: (...args: any[]) => void) => {
          if (event === 'data') {
            // 여러 세션 키 반환
            handler(['refresh:user-id-123:jti-1', 'refresh:user-id-123:jti-2']);
          } else if (event === 'end') {
            handler();
          }
          return mockStream;
        }),
      };
      
      redis.scanStream.mockReturnValue(mockStream as any);
      
      const mockPipeline = {
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      redis.pipeline.mockReturnValue(mockPipeline as any);

      // When: 전체 로그아웃 요청
      await service.logoutAll(validRefreshToken);

      // Then: 모든 세션이 삭제됨
      expect(redis.scanStream).toHaveBeenCalledWith({
        match: 'refresh:user-id-123:*',
        count: 100,
      });
      expect(mockPipeline.del).toHaveBeenCalledTimes(2);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('세션이 없으면 아무 작업도 하지 않는다', async () => {
      // Given: 유효한 토큰이지만 세션 없음
      jwtService.verifyAsync.mockResolvedValue(mockPayload as any);

      const mockStream = {
        on: jest.fn((event: string, handler: (...args: any[]) => void) => {
          if (event === 'end') {
            handler();
          }
          return mockStream;
        }),
      };

      redis.scanStream.mockReturnValue(mockStream as any);

      // When: 전체 로그아웃 요청
      await service.logoutAll(validRefreshToken);

      // Then: pipeline이 호출되지 않음
      expect(redis.pipeline).not.toHaveBeenCalled();
    });

    it('유효하지 않은 토큰이어도 에러를 던지지 않는다', async () => {
      // Given: 유효하지 않은 토큰
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      // When & Then: 에러가 발생하지 않음
      await expect(service.logoutAll(validRefreshToken)).resolves.not.toThrow();
      expect(redis.scanStream).not.toHaveBeenCalled();
    });
  });
});
