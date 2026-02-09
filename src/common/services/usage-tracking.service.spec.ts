/**
 * UsageTrackingService 테스트
 *
 * 사용량 추적 서비스의 핵심 로직을 테스트
 * - 오늘의 사용량 조회/생성
 * - 사용량 제한 체크
 * - 사용량 증가
 * - 사용량 통계 조회
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UsageTrackingService } from './usage-tracking.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { createMockPrismaService } from '../../test/test-helpers';

describe('UsageTrackingService', () => {
  let service: UsageTrackingService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const userId = 'user-123';
  const today = new Date().toISOString().split('T')[0];

  const createTestUsageTracking = (overrides = {}) => ({
    id: 'usage-id',
    userId,
    date: today,
    basicRequests: 0,
    advancedRequests: 0,
    totalTokensUsed: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageTrackingService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UsageTrackingService>(UsageTrackingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('오늘의 사용량 조회 (getTodayUsage)', () => {
    it('기존 사용량 레코드가 있으면 반환해야 한다', async () => {
      // Given: 기존 사용량 존재
      const existingUsage = createTestUsageTracking({
        basicRequests: 5,
        advancedRequests: 2,
      });
      prisma.usageTracking.findUnique.mockResolvedValue(existingUsage as any);

      // When: 오늘의 사용량 조회
      const result = await service.getTodayUsage(userId);

      // Then: 기존 레코드 반환
      expect(result).toEqual(existingUsage);
      expect(prisma.usageTracking.create).not.toHaveBeenCalled();
    });

    it('사용량 레코드가 없으면 새로 생성해야 한다', async () => {
      // Given: 사용량 레코드 없음
      prisma.usageTracking.findUnique.mockResolvedValue(null);
      const newUsage = createTestUsageTracking();
      prisma.usageTracking.create.mockResolvedValue(newUsage as any);

      // When: 오늘의 사용량 조회
      const result = await service.getTodayUsage(userId);

      // Then: 새 레코드 생성됨
      expect(result).toEqual(newUsage);
      expect(prisma.usageTracking.create).toHaveBeenCalledWith({
        data: {
          userId,
          date: today,
          basicRequests: 0,
          advancedRequests: 0,
          totalTokensUsed: 0,
        },
      });
    });
  });

  describe('사용량 제한 체크 (checkUsageLimit)', () => {
    it('활성 구독이 있으면 무제한 허용해야 한다', async () => {
      // Given: 활성 구독 있는 사용자
      const usage = createTestUsageTracking({
        basicRequests: 100,
        advancedRequests: 100,
      });
      prisma.usageTracking.findUnique.mockResolvedValue(usage as any);
      prisma.usageTracking.create.mockResolvedValue(usage as any);

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const user = {
        id: userId,
        subscriptions: [
          {
            id: 'sub-1',
            status: 'active' as const,
            startAt: new Date('2024-01-01'),
            endAt: futureDate, // 미래 날짜
          },
        ],
      };
      prisma.user.findUnique.mockResolvedValue(user as any);

      // When: 제한 체크
      const result = await service.checkUsageLimit(userId, 'free', false);

      // Then: 무제한 허용
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('free 티어는 기본 요청 제한을 체크해야 한다', async () => {
      // Given: 사용량 9/10
      const usage = createTestUsageTracking({
        basicRequests: 5,
        advancedRequests: 4,
      });
      prisma.usageTracking.findUnique.mockResolvedValue(usage as any);
      prisma.usageTracking.create.mockResolvedValue(usage as any);
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        subscriptions: [],
      } as any);

      // When: 제한 체크
      const result = await service.checkUsageLimit(userId, 'free', false);

      // Then: 허용됨
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1); // 10 - 9
    });

    it('free 티어는 제한을 초과하면 거부해야 한다', async () => {
      // Given: 사용량 10/10 (제한 도달)
      const usage = createTestUsageTracking({
        basicRequests: 6,
        advancedRequests: 4,
      });
      prisma.usageTracking.findUnique.mockResolvedValue(usage as any);
      prisma.usageTracking.create.mockResolvedValue(usage as any);
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        subscriptions: [],
      } as any);

      // When: 제한 체크
      const result = await service.checkUsageLimit(userId, 'free', false);

      // Then: 거부됨
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('오늘의 사용 횟수를 모두 사용했습니다');
      expect(result.remaining).toBe(0);
    });

    it('고급 기능은 별도 제한을 체크해야 한다', async () => {
      // Given: 고급 기능 사용량 4/5
      const usage = createTestUsageTracking({
        basicRequests: 3,
        advancedRequests: 4,
      });
      prisma.usageTracking.findUnique.mockResolvedValue(usage as any);
      prisma.usageTracking.create.mockResolvedValue(usage as any);
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        subscriptions: [],
      } as any);

      // When: 고급 기능 제한 체크
      const result = await service.checkUsageLimit(userId, 'free', true);

      // Then: 허용됨
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1); // 5 - 4
    });

    it('premium 티어는 더 높은 제한을 가져야 한다', async () => {
      // Given: premium 티어 (100회 제한)
      const usage = createTestUsageTracking({
        basicRequests: 20,
        advancedRequests: 20,
      });
      prisma.usageTracking.findUnique.mockResolvedValue(usage as any);
      prisma.usageTracking.create.mockResolvedValue(usage as any);
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        subscriptions: [],
      } as any);

      // When: 제한 체크
      const result = await service.checkUsageLimit(userId, 'premium', false);

      // Then: 허용됨 (100 - 40 = 60 남음)
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(60);
    });
  });

  describe('사용량 증가 (incrementUsage)', () => {
    it('기본 요청 사용량을 증가시켜야 한다', async () => {
      // Given: 기존 사용량
      const existingUsage = createTestUsageTracking({
        basicRequests: 5,
        advancedRequests: 2,
        totalTokensUsed: 1000,
      });
      prisma.usageTracking.upsert.mockResolvedValue(existingUsage as any);

      // When: 기본 요청 사용량 증가
      await service.incrementUsage(userId, false, 100);

      // Then: basicRequests 증가
      expect(prisma.usageTracking.upsert).toHaveBeenCalledWith({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
        create: {
          userId,
          date: today,
          basicRequests: 1,
          advancedRequests: 0,
          totalTokensUsed: 100,
        },
        update: {
          basicRequests: { increment: 1 },
          advancedRequests: undefined,
          totalTokensUsed: { increment: 100 },
        },
      });
    });

    it('고급 요청 사용량을 증가시켜야 한다', async () => {
      // Given: 고급 요청
      prisma.usageTracking.upsert.mockResolvedValue({} as any);

      // When: 고급 요청 사용량 증가
      await service.incrementUsage(userId, true, 200);

      // Then: advancedRequests 증가
      expect(prisma.usageTracking.upsert).toHaveBeenCalledWith({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
        create: {
          userId,
          date: today,
          basicRequests: 0,
          advancedRequests: 1,
          totalTokensUsed: 200,
        },
        update: {
          basicRequests: undefined,
          advancedRequests: { increment: 1 },
          totalTokensUsed: { increment: 200 },
        },
      });
    });

    it('레코드가 없으면 새로 생성해야 한다', async () => {
      // Given: 레코드 없음
      const newUsage = createTestUsageTracking({
        basicRequests: 1,
        totalTokensUsed: 150,
      });
      prisma.usageTracking.upsert.mockResolvedValue(newUsage as any);

      // When: 사용량 증가
      await service.incrementUsage(userId, false, 150);

      // Then: upsert의 create 부분이 실행됨
      expect(prisma.usageTracking.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userId,
            date: today,
            basicRequests: 1,
            totalTokensUsed: 150,
          }),
        }),
      );
    });
  });

  describe('사용량 통계 조회 (getUsageStats)', () => {
    it('지정된 기간의 사용량 통계를 조회해야 한다', async () => {
      // Given: 7일간 사용량 데이터
      const stats = [
        createTestUsageTracking({ date: today, basicRequests: 5 }),
        createTestUsageTracking({ date: '2024-01-01', basicRequests: 3 }),
      ];
      prisma.usageTracking.findMany.mockResolvedValue(stats as any);

      // When: 7일간 통계 조회
      const result = await service.getUsageStats(userId, 7);

      // Then: 통계 반환
      expect(result).toEqual(stats);
      expect(prisma.usageTracking.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          createdAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        orderBy: {
          date: 'desc',
        },
      });
    });

    it('기본 7일간 통계를 조회해야 한다', async () => {
      // Given: days 인자 없음
      prisma.usageTracking.findMany.mockResolvedValue([]);

      // When: 통계 조회 (기본값)
      await service.getUsageStats(userId);

      // Then: 7일간 조회됨
      expect(prisma.usageTracking.findMany).toHaveBeenCalled();
    });

    it('빈 결과를 반환할 수 있어야 한다', async () => {
      // Given: 사용량 데이터 없음
      prisma.usageTracking.findMany.mockResolvedValue([]);

      // When: 통계 조회
      const result = await service.getUsageStats(userId, 30);

      // Then: 빈 배열 반환
      expect(result).toEqual([]);
    });
  });
});
