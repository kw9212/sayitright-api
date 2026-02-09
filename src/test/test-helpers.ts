/**
 * 테스트 헬퍼 유틸리티
 *
 * 테스트 작성 시 반복적으로 사용되는 Mock 객체와 헬퍼 함수들
 */

import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

/**
 * Mock PrismaService
 *
 * Prisma 클라이언트의 모든 메서드를 jest.fn()으로 제공
 * 각 테스트에서 필요한 메서드만 mockResolvedValue 등으로 구현하면 됨
 */
export const createMockPrismaService = () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  expressionNote: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  template: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  archive: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  usageLog: {
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  emailVerification: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  usageTracking: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
});

/**
 * Mock Redis Client
 *
 * Redis 클라이언트의 주요 메서드를 jest.fn()으로 제공
 */
export const createMockRedis = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  scanStream: jest.fn(),
  pipeline: jest.fn(() => ({
    del: jest.fn(),
    exec: jest.fn(),
  })),
});

/**
 * Mock JwtService
 *
 * JWT 토큰 생성 및 검증 메서드를 제공
 */
export const createMockJwtService = () => ({
  sign: jest.fn(),
  signAsync: jest.fn(),
  verify: jest.fn(),
  verifyAsync: jest.fn(),
  decode: jest.fn(),
});

/**
 * Mock ConfigService
 *
 * 환경변수 조회 메서드를 제공
 */
export const createMockConfigService = () => ({
  get: jest.fn((key: string, defaultValue?: any) => {
    const config: Record<string, any> = {
      JWT_SECRET: 'test-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_REFRESH_TTL_SEC: '604800', // 7일
      OPENAI_API_KEY: 'test-openai-key',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
    };
    return config[key] ?? defaultValue;
  }),
});

/**
 * 테스트용 사용자 데이터 생성
 */
export const createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  passwordHash: '$2b$10$testHashedPassword',
  authProvider: 'local' as const,
  authProviderId: null,
  tier: 'free' as const,
  creditBalance: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

/**
 * 테스트용 노트 데이터 생성
 */
export const createTestNote = (overrides = {}) => ({
  id: 'test-note-id',
  userId: 'test-user-id',
  term: '테스트 용어',
  description: '테스트 설명',
  example: '테스트 예시',
  isStarred: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

/**
 * 테스트용 템플릿 데이터 생성
 */
export const createTestTemplate = (overrides = {}) => ({
  id: 'test-template-id',
  userId: 'test-user-id',
  title: '테스트 템플릿',
  content: '테스트 내용',
  isStarred: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

/**
 * 테스트 모듈 생성 헬퍼
 *
 * 공통적으로 사용되는 providers 쉽게 설정 가능
 */
export const createTestingModule = async (metadata: ModuleMetadata): Promise<TestingModule> => {
  return Test.createTestingModule(metadata).compile();
};

/**
 * 비동기 함수가 특정 에러를 던지는지 검증하는 헬퍼
 */
export const expectToThrowAsync = async (
  fn: () => Promise<any>,
  errorType?: any,
  errorMessage?: string | RegExp,
) => {
  try {
    await fn();
    fail('Expected function to throw, but it did not');
  } catch (error) {
    if (errorType) {
      expect(error).toBeInstanceOf(errorType);
    }
    if (errorMessage) {
      if (typeof errorMessage === 'string') {
        expect(error.message).toContain(errorMessage);
      } else {
        expect(error.message).toMatch(errorMessage);
      }
    }
  }
};
