/**
 * Templates Service 통합 테스트
 *
 * 복잡한 비즈니스 로직을 포함한 통합 시나리오 테스트
 * - 티어별 템플릿 생성 권한 체크
 * - 크레딧 차감 및 트랜잭션 생성
 * - 중복 아카이브 전환 방지
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TemplatesService Integration Tests', () => {
  let service: TemplatesService;

  const mockPrismaService = {
    template: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    creditTransaction: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);

    jest.clearAllMocks();
  });

  describe('create - 티어별 생성 권한 통합 시나리오', () => {
    const userId = 'user-123';
    const createDto = {
      title: '테스트 템플릿',
      content: '테스트 내용입니다.',
      tone: 'formal',
      relationship: 'colleague',
      purpose: 'request',
    };

    it('Guest 티어 - 첫 템플릿 생성 성공', async () => {
      // Given: Guest 유저, 0개 템플릿 보유
      mockPrismaService.template.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        tier: 'guest',
        creditBalance: 0,
      });
      mockPrismaService.template.count.mockResolvedValue(0);
      mockPrismaService.template.create.mockResolvedValue({
        id: 'template-123',
        userId,
        ...createDto,
      });

      // When: 템플릿 생성
      const result = await service.create(userId, createDto);

      // Then: 생성 성공, 크레딧 차감 없음
      expect(result.id).toBe('template-123');
      expect(result.creditCharged).toBe(0);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(mockPrismaService.creditTransaction.create).not.toHaveBeenCalled();
    });

    it('Guest 티어 - 2번째 템플릿 생성 실패 (한도 초과)', async () => {
      // Given: Guest 유저, 1개 템플릿 보유
      mockPrismaService.template.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        tier: 'guest',
        creditBalance: 0,
      });
      mockPrismaService.template.count.mockResolvedValue(1);

      // When & Then: 템플릿 생성 실패
      await expect(service.create(userId, createDto)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.template.create).not.toHaveBeenCalled();
    });

    it('Free 티어 - 3개까지 무료 생성', async () => {
      // Given: Free 유저, 2개 템플릿 보유
      mockPrismaService.template.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        tier: 'free',
        creditBalance: 5,
      });
      mockPrismaService.template.count.mockResolvedValue(2);
      mockPrismaService.template.create.mockResolvedValue({
        id: 'template-123',
        userId,
        ...createDto,
      });

      // When: 3번째 템플릿 생성
      const result = await service.create(userId, createDto);

      // Then: 생성 성공, 크레딧 차감 없음
      expect(result.id).toBe('template-123');
      expect(result.creditCharged).toBe(0);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('Free 티어 - 4번째 템플릿은 크레딧 차감', async () => {
      // Given: Free 유저, 3개 템플릿 보유, 크레딧 5개
      mockPrismaService.template.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        tier: 'free',
        creditBalance: 5,
      });
      mockPrismaService.template.count.mockResolvedValue(3);
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        creditBalance: 4,
      });
      mockPrismaService.creditTransaction.create.mockResolvedValue({
        id: 'tx-123',
        userId,
        amount: -1,
        status: 'completed',
        reason: '템플릿 저장',
      });
      mockPrismaService.template.create.mockResolvedValue({
        id: 'template-123',
        userId,
        ...createDto,
      });

      // When: 4번째 템플릿 생성
      const result = await service.create(userId, createDto);

      // Then: 생성 성공, 크레딧 1개 차감
      expect(result.id).toBe('template-123');
      expect(result.creditCharged).toBe(1);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          creditBalance: {
            decrement: 1,
          },
        },
      });
      expect(mockPrismaService.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          userId,
          amount: -1,
          status: 'completed',
          reason: '템플릿 저장',
        },
      });
    });

    it('Free 티어 - 크레딧 부족 시 생성 실패', async () => {
      // Given: Free 유저, 3개 템플릿 보유, 크레딧 0개
      mockPrismaService.template.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        tier: 'free',
        creditBalance: 0,
      });
      mockPrismaService.template.count.mockResolvedValue(3);

      // When & Then: 템플릿 생성 실패
      await expect(service.create(userId, createDto)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.template.create).not.toHaveBeenCalled();
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('Premium 티어 - 3개까지 무료, 4번째부터 크레딧 차감', async () => {
      // Given: Premium 유저, 3개 템플릿 보유, 크레딧 10개
      mockPrismaService.template.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        tier: 'premium',
        creditBalance: 10,
      });
      mockPrismaService.template.count.mockResolvedValue(3);
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        creditBalance: 9,
      });
      mockPrismaService.creditTransaction.create.mockResolvedValue({
        id: 'tx-123',
        userId,
        amount: -1,
        status: 'completed',
        reason: '템플릿 저장',
      });
      mockPrismaService.template.create.mockResolvedValue({
        id: 'template-123',
        userId,
        ...createDto,
      });

      // When: 4번째 템플릿 생성
      const result = await service.create(userId, createDto);

      // Then: 생성 성공, 크레딧 1개 차감
      expect(result.id).toBe('template-123');
      expect(result.creditCharged).toBe(1);
      expect(mockPrismaService.user.update).toHaveBeenCalled();
      expect(mockPrismaService.creditTransaction.create).toHaveBeenCalled();
    });

    it('Subscription 티어 - 무제한 생성 가능', async () => {
      // Given: Subscription 유저, 100개 템플릿 보유
      mockPrismaService.template.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        tier: 'subscription',
        creditBalance: 0,
      });
      mockPrismaService.template.count.mockResolvedValue(100);
      mockPrismaService.template.create.mockResolvedValue({
        id: 'template-123',
        userId,
        ...createDto,
      });

      // When: 101번째 템플릿 생성
      const result = await service.create(userId, createDto);

      // Then: 생성 성공, 크레딧 차감 없음
      expect(result.id).toBe('template-123');
      expect(result.creditCharged).toBe(0);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('create - 아카이브 전환 중복 체크', () => {
    const userId = 'user-123';
    const archiveId = 'archive-123';

    it('아카이브가 이미 템플릿으로 전환된 경우 ConflictException', async () => {
      // Given: 이미 템플릿으로 전환된 아카이브
      mockPrismaService.template.findUnique.mockResolvedValue({
        id: 'existing-template-123',
        sourceArchiveId: archiveId,
        createdAt: new Date(),
      });

      // When & Then: 중복 전환 시도 시 예외 발생
      await expect(
        service.create(userId, {
          title: '테스트',
          content: '내용',
          tone: 'formal',
          relationship: 'colleague',
          purpose: 'request',
          sourceArchiveId: archiveId,
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('아카이브가 처음 전환되는 경우 정상 생성', async () => {
      // Given: 전환되지 않은 아카이브
      mockPrismaService.template.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        tier: 'free',
        creditBalance: 10,
      });
      mockPrismaService.template.count.mockResolvedValue(0);
      mockPrismaService.template.create.mockResolvedValue({
        id: 'template-123',
        userId,
        sourceArchiveId: archiveId,
      });

      // When: 아카이브 전환
      const result = await service.create(userId, {
        title: '테스트',
        content: '내용',
        tone: 'formal',
        relationship: 'colleague',
        purpose: 'request',
        sourceArchiveId: archiveId,
      });

      // Then: 정상 생성
      expect(result.id).toBe('template-123');
      expect(mockPrismaService.template.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceArchiveId: archiveId,
          }),
        }),
      );
    });
  });

  describe('create - 사용자 존재 여부 체크', () => {
    it('존재하지 않는 사용자의 경우 NotFoundException', async () => {
      // Given: 존재하지 않는 사용자
      mockPrismaService.template.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // When & Then: 예외 발생
      await expect(
        service.create('non-existent-user', {
          title: '테스트',
          content: '내용',
          tone: 'formal',
          relationship: 'colleague',
          purpose: 'request',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.template.count).not.toHaveBeenCalled();
    });
  });

  describe('create - 경계값 테스트', () => {
    const userId = 'user-123';

    it('Free 티어 3번째 (마지막 무료)', async () => {
      mockPrismaService.template.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        tier: 'free',
        creditBalance: 5,
      });
      mockPrismaService.template.count.mockResolvedValue(2);
      mockPrismaService.template.create.mockResolvedValue({
        id: 'template-123',
      });

      const result = await service.create(userId, {
        title: '테스트',
        content: '내용',
        tone: 'formal',
        relationship: 'colleague',
        purpose: 'request',
      });

      expect(result.creditCharged).toBe(0);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('Free 티어 4번째 (첫 유료)', async () => {
      mockPrismaService.template.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        tier: 'free',
        creditBalance: 5,
      });
      mockPrismaService.template.count.mockResolvedValue(3);
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.creditTransaction.create.mockResolvedValue({});
      mockPrismaService.template.create.mockResolvedValue({
        id: 'template-123',
      });

      const result = await service.create(userId, {
        title: '테스트',
        content: '내용',
        tone: 'formal',
        relationship: 'colleague',
        purpose: 'request',
      });

      expect(result.creditCharged).toBe(1);
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });
  });
});
