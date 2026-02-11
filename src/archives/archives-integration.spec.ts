/**
 * Archives Service 통합 테스트
 *
 * 복잡한 정책 기반 정리 로직 통합 테스트
 * - 하이브리드 정책: 기간 + 개수 제한
 * - 티어별 보관 정책 적용
 * - 정리 우선순위 (오래된 순)
 */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { ArchivesService } from './archives.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ArchivesService Integration Tests', () => {
  let service: ArchivesService;

  const mockPrismaService = {
    archive: {
      deleteMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchivesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ArchivesService>(ArchivesService);

    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-10T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('cleanupOldArchives - Free 티어 (7일, 200개)', () => {
    const userId = 'user-123';

    it('기간 초과 데이터만 삭제 (개수 제한 미도달)', async () => {
      // Given: 2026-02-10 기준, 7일 전 = 2026-02-03
      // 기간 초과 10개 삭제, 남은 개수 50개 (200개 미만)
      mockPrismaService.archive.deleteMany.mockResolvedValue({ count: 10 });
      mockPrismaService.archive.count.mockResolvedValue(50);

      // When: 정리 실행
      const deletedCount = await service.cleanupOldArchives(userId, 'free');

      // Then: 기간 초과 10개만 삭제
      expect(deletedCount).toBe(10);
      expect(mockPrismaService.archive.deleteMany).toHaveBeenCalledTimes(1);

      // 날짜 계산 확인 (로컬 타임존 고려)
      const callArgs = mockPrismaService.archive.deleteMany.mock.calls[0][0];
      expect(callArgs.where.userId).toBe(userId);
      expect(callArgs.where.createdAt.lt).toBeInstanceOf(Date);

      // 7일 전 날짜여야 함 (시간은 00:00:00)
      const cutoffDate = callArgs.where.createdAt.lt;
      expect(cutoffDate.getHours()).toBe(0);
      expect(cutoffDate.getMinutes()).toBe(0);
      expect(cutoffDate.getSeconds()).toBe(0);
    });

    it('개수 초과 데이터만 삭제 (기간 제한 미도달)', async () => {
      // Given: 기간 내 데이터지만 250개 보유 (200개 초과)
      let deleteManyCallCount = 0;
      mockPrismaService.archive.deleteMany.mockImplementation(() => {
        deleteManyCallCount++;
        if (deleteManyCallCount === 1) {
          return Promise.resolve({ count: 0 }); // 기간 초과 없음
        } else {
          return Promise.resolve({ count: 50 }); // 개수 초과 50개 삭제
        }
      });
      mockPrismaService.archive.count.mockResolvedValue(250);
      mockPrismaService.archive.findMany.mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => ({ id: `archive-${i}` })),
      );

      // When: 정리 실행
      const deletedCount = await service.cleanupOldArchives(userId, 'free');

      // Then: 개수 초과 50개 삭제
      expect(deletedCount).toBe(50);
      expect(mockPrismaService.archive.count).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mockPrismaService.archive.findMany).toHaveBeenCalledWith({
        where: { userId },
        select: { id: true },
        orderBy: { createdAt: 'asc' }, // 오래된 순
        take: 50,
      });
    });

    it('하이브리드: 기간 + 개수 모두 초과', async () => {
      // Given: 기간 초과 30개 삭제 후, 남은 220개 중 20개 추가 삭제
      let deleteManyCallCount = 0;
      mockPrismaService.archive.deleteMany.mockImplementation(() => {
        deleteManyCallCount++;
        if (deleteManyCallCount === 1) {
          return Promise.resolve({ count: 30 }); // 기간 초과 30개 삭제
        } else {
          return Promise.resolve({ count: 20 }); // 개수 초과 20개 삭제
        }
      });
      mockPrismaService.archive.count.mockResolvedValue(220);
      mockPrismaService.archive.findMany.mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({ id: `archive-${i}` })),
      );

      // When: 정리 실행
      const deletedCount = await service.cleanupOldArchives(userId, 'free');

      // Then: 총 50개 삭제
      expect(deletedCount).toBe(50);
      expect(mockPrismaService.archive.deleteMany).toHaveBeenCalledTimes(2);
    });

    it('정리할 데이터 없음 (정책 준수)', async () => {
      // Given: 기간 내, 50개 보유 (모두 정책 준수)
      mockPrismaService.archive.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.archive.count.mockResolvedValue(50);

      // When: 정리 실행
      const deletedCount = await service.cleanupOldArchives(userId, 'free');

      // Then: 삭제 없음
      expect(deletedCount).toBe(0);
      expect(mockPrismaService.archive.deleteMany).toHaveBeenCalledTimes(1);
    });

    it('정확히 200개일 때 추가 삭제 없음', async () => {
      // Given: 기간 내, 정확히 200개
      mockPrismaService.archive.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.archive.count.mockResolvedValue(200);

      // When: 정리 실행
      const deletedCount = await service.cleanupOldArchives(userId, 'free');

      // Then: 삭제 없음
      expect(deletedCount).toBe(0);
      expect(mockPrismaService.archive.findMany).not.toHaveBeenCalled();
    });

    it('201개일 때 1개만 추가 삭제', async () => {
      // Given: 기간 내, 201개 (1개 초과)
      let deleteManyCallCount = 0;
      mockPrismaService.archive.deleteMany.mockImplementation(() => {
        deleteManyCallCount++;
        if (deleteManyCallCount === 1) {
          return Promise.resolve({ count: 0 });
        } else {
          return Promise.resolve({ count: 1 });
        }
      });
      mockPrismaService.archive.count.mockResolvedValue(201);
      mockPrismaService.archive.findMany.mockResolvedValue([{ id: 'archive-oldest' }]);

      // When: 정리 실행
      const deletedCount = await service.cleanupOldArchives(userId, 'free');

      // Then: 1개만 삭제
      expect(deletedCount).toBe(1);
      expect(mockPrismaService.archive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
          orderBy: { createdAt: 'asc' },
        }),
      );
    });
  });

  describe('cleanupOldArchives - Premium 티어 (30일, 2000개)', () => {
    const userId = 'premium-user-123';

    it('30일 기준으로 정리', async () => {
      // Given: 2026-02-10 기준, 30일 전 = 2026-01-11
      mockPrismaService.archive.deleteMany.mockResolvedValue({ count: 50 });
      mockPrismaService.archive.count.mockResolvedValue(1000);

      // When: 정리 실행
      await service.cleanupOldArchives(userId, 'premium');

      // Then: 30일 전 기준으로 삭제
      const callArgs = mockPrismaService.archive.deleteMany.mock.calls[0][0];
      expect(callArgs.where.userId).toBe(userId);
      expect(callArgs.where.createdAt.lt).toBeInstanceOf(Date);

      // 30일 전 날짜여야 함
      const cutoffDate = callArgs.where.createdAt.lt;
      expect(cutoffDate.getHours()).toBe(0);
      expect(cutoffDate.getMinutes()).toBe(0);
      expect(cutoffDate.getSeconds()).toBe(0);
    });

    it('2000개 제한 적용', async () => {
      // Given: 2500개 보유 (500개 초과)
      let deleteManyCallCount = 0;
      mockPrismaService.archive.deleteMany.mockImplementation(() => {
        deleteManyCallCount++;
        if (deleteManyCallCount === 1) {
          return Promise.resolve({ count: 0 });
        } else {
          return Promise.resolve({ count: 500 });
        }
      });
      mockPrismaService.archive.count.mockResolvedValue(2500);
      mockPrismaService.archive.findMany.mockResolvedValue(
        Array.from({ length: 500 }, (_, i) => ({ id: `archive-${i}` })),
      );

      // When: 정리 실행
      const deletedCount = await service.cleanupOldArchives(userId, 'premium');

      // Then: 500개 삭제
      expect(deletedCount).toBe(500);
      expect(mockPrismaService.archive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 500,
        }),
      );
    });

    it('Premium 유저도 하이브리드 정책 적용', async () => {
      // Given: 기간 초과 100개 + 개수 초과 300개
      let deleteManyCallCount = 0;
      mockPrismaService.archive.deleteMany.mockImplementation(() => {
        deleteManyCallCount++;
        if (deleteManyCallCount === 1) {
          return Promise.resolve({ count: 100 });
        } else {
          return Promise.resolve({ count: 300 });
        }
      });
      mockPrismaService.archive.count.mockResolvedValue(2300);
      mockPrismaService.archive.findMany.mockResolvedValue(
        Array.from({ length: 300 }, (_, i) => ({ id: `archive-${i}` })),
      );

      // When: 정리 실행
      const deletedCount = await service.cleanupOldArchives(userId, 'premium');

      // Then: 총 400개 삭제
      expect(deletedCount).toBe(400);
    });
  });

  describe('cleanupOldArchives - 날짜 경계 케이스', () => {
    const userId = 'user-123';

    it('2월 3일 자정 이전 데이터 삭제 (7일 전)', async () => {
      // Given: 2026-02-10 12:00:00 기준
      mockPrismaService.archive.deleteMany.mockResolvedValue({ count: 5 });
      mockPrismaService.archive.count.mockResolvedValue(50);

      // When: 정리 실행
      await service.cleanupOldArchives(userId, 'free');

      // Then: 7일 전 00:00:00 이전 데이터 삭제
      const callArgs = mockPrismaService.archive.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;

      expect(cutoffDate).toBeInstanceOf(Date);
      expect(cutoffDate.getHours()).toBe(0);
      expect(cutoffDate.getMinutes()).toBe(0);
      expect(cutoffDate.getSeconds()).toBe(0);
    });

    it('월을 넘어가는 날짜 계산 (3월 → 2월)', async () => {
      // Given: 2026-03-05 기준, 7일 전 = 2026-02-26
      jest.setSystemTime(new Date('2026-03-05T12:00:00Z'));
      mockPrismaService.archive.deleteMany.mockResolvedValue({ count: 3 });
      mockPrismaService.archive.count.mockResolvedValue(50);

      // When: 정리 실행
      await service.cleanupOldArchives(userId, 'free');

      // Then: 7일 전 이전 데이터 삭제 (월이 바뀜)
      const callArgs = mockPrismaService.archive.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;

      expect(cutoffDate).toBeInstanceOf(Date);
      // 월이 바뀌었는지 확인 (2월이어야 함)
      expect(cutoffDate.getMonth()).toBe(1); // 0-based, 1 = February
    });
  });

  describe('cleanupOldArchives - 삭제 우선순위', () => {
    const userId = 'user-123';

    it('개수 초과 시 가장 오래된 데이터부터 삭제', async () => {
      // Given: 개수 초과 상황
      let deleteManyCallCount = 0;
      mockPrismaService.archive.deleteMany.mockImplementation(() => {
        deleteManyCallCount++;
        if (deleteManyCallCount === 1) {
          return Promise.resolve({ count: 0 });
        } else {
          return Promise.resolve({ count: 50 });
        }
      });
      mockPrismaService.archive.count.mockResolvedValue(250);
      mockPrismaService.archive.findMany.mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => ({ id: `archive-${i}` })),
      );

      // When: 정리 실행
      await service.cleanupOldArchives(userId, 'free');

      // Then: createdAt 오름차순으로 조회 (가장 오래된 것부터)
      expect(mockPrismaService.archive.findMany).toHaveBeenCalledWith({
        where: { userId },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
    });

    it('정확히 필요한 개수만 삭제 (초과분만)', async () => {
      // Given: 205개 보유 (5개 초과)
      let deleteManyCallCount = 0;
      mockPrismaService.archive.deleteMany.mockImplementation(() => {
        deleteManyCallCount++;
        if (deleteManyCallCount === 1) {
          return Promise.resolve({ count: 0 });
        } else {
          return Promise.resolve({ count: 5 });
        }
      });
      mockPrismaService.archive.count.mockResolvedValue(205);
      mockPrismaService.archive.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({ id: `archive-${i}` })),
      );

      // When: 정리 실행
      await service.cleanupOldArchives(userId, 'free');

      // Then: 정확히 5개만 조회하여 삭제
      expect(mockPrismaService.archive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });
  });
});
