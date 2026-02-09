/**
 * ArchivesService 테스트
 *
 * 아카이브 관리 서비스의 핵심 로직을 테스트
 * - 아카이브 목록 조회 (페이징, 필터링)
 * - 아카이브 단건 조회
 * - 아카이브 삭제
 * - 오래된 아카이브 자동 정리
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ArchivesService } from './archives.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createMockPrismaService, expectToThrowAsync } from '../test/test-helpers';

describe('ArchivesService', () => {
  let service: ArchivesService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const userId = 'user-123';
  const otherUserId = 'other-user-456';

  const createTestArchive = (overrides = {}) => ({
    id: 'archive-id',
    userId,
    title: '테스트 아카이브',
    content: '아카이브 내용',
    preview: '아카이브 미리보기',
    tone: 'formal',
    purpose: '요청',
    target: null,
    relationship: '상사',
    rationale: '근거',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchivesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ArchivesService>(ArchivesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('아카이브 목록 조회 (findAll)', () => {
    beforeEach(() => {
      // 기본 user 조회 Mock
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        tier: 'free',
      } as any);

      // cleanupOldArchives Mock (findAll에서 호출됨)
      jest.spyOn(service, 'cleanupOldArchives').mockResolvedValue(0);
    });

    it('기본 페이지네이션으로 아카이브 목록을 조회할 수 있어야 한다', async () => {
      // Given: 여러 아카이브가 존재
      const archives = [
        {
          id: 'archive-1',
          title: '아카이브1',
          preview: '미리보기1',
          tone: 'formal',
          purpose: '요청',
          target: null,
          relationship: '상사',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'archive-2',
          title: '아카이브2',
          preview: '미리보기2',
          tone: 'casual',
          purpose: '문의',
          target: null,
          relationship: '동료',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.archive.findMany.mockResolvedValue(archives as any);
      prisma.archive.count.mockResolvedValue(2);

      // When: 목록 조회
      const result = await service.findAll(userId, {});

      // Then: 페이징된 결과 반환
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(2);
    });

    it('페이지와 limit을 지정할 수 있어야 한다', async () => {
      // Given: 많은 아카이브가 존재
      prisma.archive.findMany.mockResolvedValue([]);
      prisma.archive.count.mockResolvedValue(50);

      // When: 2페이지, limit=10으로 조회
      const result = await service.findAll(userId, { page: 2, limit: 10 });

      // Then: 올바른 페이징 적용
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(prisma.archive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('검색어로 아카이브를 필터링할 수 있어야 한다', async () => {
      // Given: 검색어
      prisma.archive.findMany.mockResolvedValue([]);
      prisma.archive.count.mockResolvedValue(0);

      // When: 검색어로 조회
      await service.findAll(userId, { q: '회의' });

      // Then: 검색 조건이 적용됨
      expect(prisma.archive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            OR: [
              { content: { contains: '회의', mode: 'insensitive' } },
              { title: { contains: '회의', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('tone 필터를 적용할 수 있어야 한다', async () => {
      // Given: tone 필터
      prisma.archive.findMany.mockResolvedValue([]);
      prisma.archive.count.mockResolvedValue(0);

      // When: tone='formal'로 조회
      await service.findAll(userId, { tone: 'formal' });

      // Then: tone 필터가 적용됨
      expect(prisma.archive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tone: 'formal',
          }),
        }),
      );
    });

    it('날짜 범위 필터를 적용할 수 있어야 한다', async () => {
      // Given: 날짜 범위
      const from = '2024-01-01';
      const to = '2024-01-31';
      prisma.archive.findMany.mockResolvedValue([]);
      prisma.archive.count.mockResolvedValue(0);

      // When: 날짜 범위로 조회
      await service.findAll(userId, { from, to });

      // Then: 날짜 필터가 적용됨
      expect(prisma.archive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: new Date(from),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('시작 날짜가 종료 날짜보다 늦으면 BadRequestException을 던진다', async () => {
      // Given: 잘못된 날짜 범위
      const from = '2024-01-31';
      const to = '2024-01-01';

      // When & Then: BadRequestException 발생
      await expectToThrowAsync(
        () => service.findAll(userId, { from, to }),
        BadRequestException,
        '시작 날짜는 종료 날짜보다 이를 수 없습니다',
      );
    });
  });

  describe('아카이브 단건 조회 (findOne)', () => {
    it('본인의 아카이브를 조회할 수 있어야 한다', async () => {
      // Given: 존재하는 아카이브
      const archive = createTestArchive({ id: 'archive-1', userId });
      prisma.archive.findUnique.mockResolvedValue(archive as any);

      // When: 아카이브 조회
      const result = await service.findOne('archive-1', userId);

      // Then: 아카이브가 반환됨
      expect(result).toMatchObject({
        id: 'archive-1',
        title: archive.title,
      });
    });

    it('존재하지 않는 아카이브면 NotFoundException을 던진다', async () => {
      // Given: 존재하지 않는 아카이브
      prisma.archive.findUnique.mockResolvedValue(null);

      // When & Then: NotFoundException 발생
      await expectToThrowAsync(
        () => service.findOne('invalid-id', userId),
        NotFoundException,
        'Archive를 찾을 수 없습니다',
      );
    });

    it('다른 사용자의 아카이브면 ForbiddenException을 던진다', async () => {
      // Given: 다른 사용자의 아카이브
      const archive = createTestArchive({ id: 'archive-1', userId: otherUserId });
      prisma.archive.findUnique.mockResolvedValue(archive as any);

      // When & Then: ForbiddenException 발생
      await expectToThrowAsync(
        () => service.findOne('archive-1', userId),
        ForbiddenException,
        '이 Archive에 접근할 권한이 없습니다',
      );
    });
  });

  describe('아카이브 삭제 (remove)', () => {
    it('정상적으로 아카이브를 삭제할 수 있어야 한다', async () => {
      // Given: 존재하는 아카이브
      const archive = createTestArchive({ id: 'archive-1', userId });
      prisma.archive.findUnique.mockResolvedValue(archive as any);
      prisma.archive.delete.mockResolvedValue(archive as any);

      // When: 아카이브 삭제
      await service.remove('archive-1', userId);

      // Then: 아카이브가 삭제됨
      expect(prisma.archive.delete).toHaveBeenCalledWith({
        where: { id: 'archive-1' },
      });
    });

    it('다른 사용자의 아카이브는 삭제할 수 없어야 한다', async () => {
      // Given: 다른 사용자의 아카이브
      const archive = createTestArchive({ id: 'archive-1', userId: otherUserId });
      prisma.archive.findUnique.mockResolvedValue(archive as any);

      // When & Then: ForbiddenException 발생
      await expectToThrowAsync(
        () => service.remove('archive-1', userId),
        ForbiddenException,
        '이 Archive에 접근할 권한이 없습니다',
      );

      expect(prisma.archive.delete).not.toHaveBeenCalled();
    });
  });

  // Note: cleanupOldArchives는 복잡한 정책 로직이 있어 통합 테스트로 보완 예정
});
