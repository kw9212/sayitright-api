/**
 * TemplatesService 테스트
 *
 * 템플릿 관리 서비스의 핵심 로직을 테스트
 * - 템플릿 목록 조회 (페이징, 필터링)
 * - 템플릿 단건 조회
 * - 템플릿 수정
 * - 템플릿 삭제
 *
 * Note: create 메서드는 티어 정책과 크레딧 로직이 복잡하여
 * 추후 통합 테스트로 보완 예정
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  createMockPrismaService,
  createTestTemplate,
  expectToThrowAsync,
} from '../test/test-helpers';

describe('TemplatesService', () => {
  let service: TemplatesService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const userId = 'user-123';
  const otherUserId = 'other-user-456';

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('템플릿 목록 조회 (findAll)', () => {
    it('기본 페이지네이션으로 템플릿 목록을 조회할 수 있어야 한다', async () => {
      // Given: 여러 템플릿이 존재
      const templates = [
        {
          id: 'template-1',
          title: '템플릿1',
          preview: '미리보기1',
          tone: 'formal',
          purpose: '요청',
          target: null,
          relationship: '상사',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'template-2',
          title: '템플릿2',
          preview: '미리보기2',
          tone: 'casual',
          purpose: '문의',
          target: null,
          relationship: '동료',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.template.findMany.mockResolvedValue(templates as any);
      prisma.template.count.mockResolvedValue(2);

      // When: 목록 조회
      const result = await service.findAll(userId, {});

      // Then: 페이징된 결과 반환
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(2);
    });

    it('페이지와 limit을 지정할 수 있어야 한다', async () => {
      // Given: 많은 템플릿이 존재
      const templates = [
        {
          id: 'template-1',
          title: '템플릿1',
          preview: '미리보기',
          tone: 'formal',
          purpose: null,
          target: null,
          relationship: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.template.findMany.mockResolvedValue(templates as any);
      prisma.template.count.mockResolvedValue(50);

      // When: 2페이지, limit=10으로 조회
      const result = await service.findAll(userId, { page: 2, limit: 10 });

      // Then: 올바른 페이징 적용
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(50);
      expect(prisma.template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('검색어로 템플릿을 필터링할 수 있어야 한다', async () => {
      // Given: 검색어 '회의'
      const templates = [
        {
          id: 'template-1',
          title: '회의 요청',
          preview: '미리보기',
          tone: 'formal',
          purpose: null,
          target: null,
          relationship: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.template.findMany.mockResolvedValue(templates as any);
      prisma.template.count.mockResolvedValue(1);

      // When: 검색어로 조회
      const result = await service.findAll(userId, { q: '회의' });

      // Then: 검색 조건이 적용됨
      expect(result.items).toHaveLength(1);
    });

    it('tone 필터를 적용할 수 있어야 한다', async () => {
      // Given: tone 필터
      prisma.template.findMany.mockResolvedValue([]);
      prisma.template.count.mockResolvedValue(0);

      // When: tone='formal'로 조회
      await service.findAll(userId, { tone: 'formal' });

      // Then: tone 필터가 적용됨
      expect(prisma.template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            tone: 'formal',
          }),
        }),
      );
    });

    it('relationship 필터를 적용할 수 있어야 한다', async () => {
      // Given: relationship 필터
      prisma.template.findMany.mockResolvedValue([]);
      prisma.template.count.mockResolvedValue(0);

      // When: relationship='상사'로 조회
      await service.findAll(userId, { relationship: '상사' });

      // Then: relationship 필터가 적용됨
      expect(prisma.template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            relationship: '상사',
          }),
        }),
      );
    });

    it('purpose 필터를 적용할 수 있어야 한다', async () => {
      // Given: purpose 필터
      prisma.template.findMany.mockResolvedValue([]);
      prisma.template.count.mockResolvedValue(0);

      // When: purpose='요청'으로 조회
      await service.findAll(userId, { purpose: '요청' });

      // Then: purpose 필터가 적용됨
      expect(prisma.template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            purpose: '요청',
          }),
        }),
      );
    });

    it('날짜 범위 필터를 적용할 수 있어야 한다', async () => {
      // Given: 날짜 범위
      const from = '2024-01-01';
      const to = '2024-01-31';
      prisma.template.findMany.mockResolvedValue([]);
      prisma.template.count.mockResolvedValue(0);

      // When: 날짜 범위로 조회
      await service.findAll(userId, { from, to });

      // Then: 날짜 필터가 적용됨
      expect(prisma.template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
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

  describe('템플릿 단건 조회 (findOne)', () => {
    it('본인의 템플릿을 조회할 수 있어야 한다', async () => {
      // Given: 존재하는 템플릿
      const template = createTestTemplate({ id: 'template-1', userId });
      prisma.template.findUnique.mockResolvedValue(template);

      // When: 템플릿 조회
      const result = await service.findOne('template-1', userId);

      // Then: 템플릿이 반환됨
      expect(result).toMatchObject({
        id: 'template-1',
        title: template.title,
      });
    });

    it('존재하지 않는 템플릿이면 NotFoundException을 던진다', async () => {
      // Given: 존재하지 않는 템플릿
      prisma.template.findUnique.mockResolvedValue(null);

      // When & Then: NotFoundException 발생
      await expectToThrowAsync(
        () => service.findOne('invalid-id', userId),
        NotFoundException,
        'Template를 찾을 수 없습니다',
      );
    });

    it('다른 사용자의 템플릿이면 ForbiddenException을 던진다', async () => {
      // Given: 다른 사용자의 템플릿
      const template = createTestTemplate({ id: 'template-1', userId: otherUserId });
      prisma.template.findUnique.mockResolvedValue(template);

      // When & Then: ForbiddenException 발생
      await expectToThrowAsync(
        () => service.findOne('template-1', userId),
        ForbiddenException,
        '이 Template에 접근할 권한이 없습니다',
      );
    });
  });

  describe('템플릿 수정 (update)', () => {
    it('정상적으로 템플릿을 수정할 수 있어야 한다', async () => {
      // Given: 기존 템플릿과 수정할 정보
      const existingTemplate = createTestTemplate({ id: 'template-1', userId });
      prisma.template.findUnique.mockResolvedValue(existingTemplate);

      const dto = {
        title: '수정된 제목',
        tone: 'casual' as const,
        content: '수정된 내용',
      };
      const updatedTemplate = createTestTemplate({
        id: 'template-1',
        userId,
        ...dto,
      });
      prisma.template.update.mockResolvedValue(updatedTemplate);

      // When: 템플릿 수정
      const result = await service.update('template-1', userId, dto);

      // Then: 템플릿이 수정됨
      expect(result).toMatchObject({
        title: dto.title,
        content: dto.content,
      });
      expect(prisma.template.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: expect.objectContaining({
          title: dto.title,
          tone: dto.tone,
          content: dto.content,
          preview: dto.content, // 200자 미만이므로 전체가 preview
        }),
      });
    });

    it('content가 200자를 초과하면 preview를 잘라야 한다', async () => {
      // Given: 긴 내용
      const existingTemplate = createTestTemplate({ id: 'template-1', userId });
      prisma.template.findUnique.mockResolvedValue(existingTemplate);

      const longContent = 'a'.repeat(250);
      const dto = {
        content: longContent,
      };
      const updatedTemplate = createTestTemplate({
        id: 'template-1',
        userId,
        content: longContent,
      });
      prisma.template.update.mockResolvedValue(updatedTemplate);

      // When: 템플릿 수정
      await service.update('template-1', userId, dto);

      // Then: preview가 200자로 제한되고 ... 추가됨
      expect(prisma.template.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: expect.objectContaining({
          content: longContent,
          preview: 'a'.repeat(197) + '...',
        }),
      });
    });

    it('일부 필드만 수정할 수 있어야 한다', async () => {
      // Given: 기존 템플릿
      const existingTemplate = createTestTemplate({ id: 'template-1', userId });
      prisma.template.findUnique.mockResolvedValue(existingTemplate);

      const dto = {
        title: '수정된 제목만',
      };
      const updatedTemplate = createTestTemplate({
        id: 'template-1',
        userId,
        title: dto.title,
      });
      prisma.template.update.mockResolvedValue(updatedTemplate);

      // When: 일부 필드만 수정
      await service.update('template-1', userId, dto);

      // Then: 해당 필드만 업데이트됨
      expect(prisma.template.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: {
          title: dto.title,
        },
      });
    });

    it('다른 사용자의 템플릿은 수정할 수 없어야 한다', async () => {
      // Given: 다른 사용자의 템플릿
      const otherTemplate = createTestTemplate({ id: 'template-1', userId: otherUserId });
      prisma.template.findUnique.mockResolvedValue(otherTemplate);

      const dto = { title: '수정 시도' };

      // When & Then: ForbiddenException 발생
      await expectToThrowAsync(
        () => service.update('template-1', userId, dto),
        ForbiddenException,
        '이 Template에 접근할 권한이 없습니다',
      );

      expect(prisma.template.update).not.toHaveBeenCalled();
    });
  });

  describe('템플릿 삭제 (remove)', () => {
    it('정상적으로 템플릿을 삭제할 수 있어야 한다', async () => {
      // Given: 존재하는 템플릿
      const template = createTestTemplate({ id: 'template-1', userId });
      prisma.template.findUnique.mockResolvedValue(template);
      prisma.template.delete.mockResolvedValue(template);

      // When: 템플릿 삭제
      await service.remove('template-1', userId);

      // Then: 템플릿이 삭제됨
      expect(prisma.template.delete).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      });
    });

    it('다른 사용자의 템플릿은 삭제할 수 없어야 한다', async () => {
      // Given: 다른 사용자의 템플릿
      const otherTemplate = createTestTemplate({ id: 'template-1', userId: otherUserId });
      prisma.template.findUnique.mockResolvedValue(otherTemplate);

      // When & Then: ForbiddenException 발생
      await expectToThrowAsync(
        () => service.remove('template-1', userId),
        ForbiddenException,
        '이 Template에 접근할 권한이 없습니다',
      );

      expect(prisma.template.delete).not.toHaveBeenCalled();
    });

    it('존재하지 않는 템플릿이면 NotFoundException을 던진다', async () => {
      // Given: 존재하지 않는 템플릿
      prisma.template.findUnique.mockResolvedValue(null);

      // When & Then: NotFoundException 발생
      await expectToThrowAsync(
        () => service.remove('invalid-id', userId),
        NotFoundException,
        'Template를 찾을 수 없습니다',
      );

      expect(prisma.template.delete).not.toHaveBeenCalled();
    });
  });
});
