/**
 * NotesService 테스트
 *
 * 노트(용어) 관리 서비스의 핵심 로직을 테스트
 * - 노트 목록 조회 (페이징, 검색, 정렬)
 * - 노트 단건 조회
 * - 노트 생성
 * - 노트 수정
 * - 노트 삭제
 * - 즐겨찾기 토글
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotesService } from './notes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createMockPrismaService, createTestNote, expectToThrowAsync } from '../test/test-helpers';

describe('NotesService', () => {
  let service: NotesService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const userId = 'user-123';
  const otherUserId = 'other-user-456';

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('노트 목록 조회 (findAll)', () => {
    it('기본 페이지네이션으로 노트 목록을 조회할 수 있어야 한다', async () => {
      // Given: 여러 노트가 존재
      const notes = [
        createTestNote({ id: 'note-1', userId, term: '용어1' }),
        createTestNote({ id: 'note-2', userId, term: '용어2' }),
      ];
      prisma.expressionNote.findMany.mockResolvedValue(notes);
      prisma.expressionNote.count.mockResolvedValue(2);

      // When: 목록 조회 (기본값: page=1, limit=10)
      const result = await service.findAll(userId, {});

      // Then: 페이징된 결과 반환
      expect(result.notes).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(2);
      expect(prisma.expressionNote.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: [{ isStarred: 'desc' }, { createdAt: 'desc' }],
        skip: 0,
        take: 10,
      });
    });

    it('페이지와 limit을 지정할 수 있어야 한다', async () => {
      // Given: 많은 노트가 존재
      const notes = [createTestNote({ id: 'note-1', userId })];
      prisma.expressionNote.findMany.mockResolvedValue(notes);
      prisma.expressionNote.count.mockResolvedValue(25);

      // When: 2페이지, limit=5로 조회
      const result = await service.findAll(userId, { page: '2', limit: '5' });

      // Then: 올바른 페이징 적용
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.total).toBe(25);
      expect(prisma.expressionNote.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: expect.any(Array),
        skip: 5, // (2 - 1) * 5
        take: 5,
      });
    });

    it('검색어로 노트를 필터링할 수 있어야 한다', async () => {
      // Given: 검색어 '회의'
      const notes = [createTestNote({ id: 'note-1', userId, term: '회의 참석' })];
      prisma.expressionNote.findMany.mockResolvedValue(notes);
      prisma.expressionNote.count.mockResolvedValue(1);

      // When: 검색어로 조회
      const result = await service.findAll(userId, { q: '회의' });

      // Then: 검색 조건이 적용됨
      expect(result.notes).toHaveLength(1);
      expect(prisma.expressionNote.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          OR: [
            { term: { contains: '회의', mode: 'insensitive' } },
            { description: { contains: '회의', mode: 'insensitive' } },
            { example: { contains: '회의', mode: 'insensitive' } },
          ],
        },
        orderBy: expect.any(Array),
        skip: 0,
        take: 10,
      });
    });

    it('공백만 있는 검색어는 무시해야 한다', async () => {
      // Given: 공백만 있는 검색어
      const notes = [createTestNote({ id: 'note-1', userId })];
      prisma.expressionNote.findMany.mockResolvedValue(notes);
      prisma.expressionNote.count.mockResolvedValue(1);

      // When: 공백 검색어로 조회
      await service.findAll(userId, { q: '   ' });

      // Then: 검색 조건 없이 조회됨
      expect(prisma.expressionNote.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: expect.any(Array),
        skip: 0,
        take: 10,
      });
    });

    it('정렬 옵션을 적용할 수 있어야 한다 - latest (기본값)', async () => {
      // Given: 정렬 옵션
      prisma.expressionNote.findMany.mockResolvedValue([]);
      prisma.expressionNote.count.mockResolvedValue(0);

      // When: latest 정렬
      await service.findAll(userId, { sort: 'latest' });

      // Then: 즐겨찾기 우선, 최신순 정렬
      expect(prisma.expressionNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ isStarred: 'desc' }, { createdAt: 'desc' }],
        }),
      );
    });

    it('정렬 옵션을 적용할 수 있어야 한다 - oldest', async () => {
      // Given: 정렬 옵션
      prisma.expressionNote.findMany.mockResolvedValue([]);
      prisma.expressionNote.count.mockResolvedValue(0);

      // When: oldest 정렬
      await service.findAll(userId, { sort: 'oldest' });

      // Then: 오래된 순 정렬
      expect(prisma.expressionNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'asc' }],
        }),
      );
    });

    it('정렬 옵션을 적용할 수 있어야 한다 - term_asc', async () => {
      // Given: 정렬 옵션
      prisma.expressionNote.findMany.mockResolvedValue([]);
      prisma.expressionNote.count.mockResolvedValue(0);

      // When: term_asc 정렬
      await service.findAll(userId, { sort: 'term_asc' });

      // Then: 용어명 오름차순 정렬
      expect(prisma.expressionNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ term: 'asc' }],
        }),
      );
    });

    it('정렬 옵션을 적용할 수 있어야 한다 - term_desc', async () => {
      // Given: 정렬 옵션
      prisma.expressionNote.findMany.mockResolvedValue([]);
      prisma.expressionNote.count.mockResolvedValue(0);

      // When: term_desc 정렬
      await service.findAll(userId, { sort: 'term_desc' });

      // Then: 용어명 내림차순 정렬
      expect(prisma.expressionNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ term: 'desc' }],
        }),
      );
    });
  });

  describe('노트 단건 조회 (findOne)', () => {
    it('본인의 노트를 조회할 수 있어야 한다', async () => {
      // Given: 존재하는 노트
      const note = createTestNote({ id: 'note-1', userId });
      prisma.expressionNote.findUnique.mockResolvedValue(note);

      // When: 노트 조회
      const result = await service.findOne('note-1', userId);

      // Then: 노트가 반환됨
      expect(result).toMatchObject({
        id: 'note-1',
        term: note.term,
      });
      expect(prisma.expressionNote.findUnique).toHaveBeenCalledWith({
        where: { id: 'note-1' },
      });
    });

    it('존재하지 않는 노트면 NotFoundException을 던진다', async () => {
      // Given: 존재하지 않는 노트
      prisma.expressionNote.findUnique.mockResolvedValue(null);

      // When & Then: NotFoundException 발생
      await expectToThrowAsync(
        () => service.findOne('invalid-id', userId),
        NotFoundException,
        '용어를 찾을 수 없습니다',
      );
    });

    it('다른 사용자의 노트면 ForbiddenException을 던진다', async () => {
      // Given: 다른 사용자의 노트
      const note = createTestNote({ id: 'note-1', userId: otherUserId });
      prisma.expressionNote.findUnique.mockResolvedValue(note);

      // When & Then: ForbiddenException 발생
      await expectToThrowAsync(
        () => service.findOne('note-1', userId),
        ForbiddenException,
        '접근 권한이 없습니다',
      );
    });
  });

  describe('노트 생성 (create)', () => {
    it('정상적으로 노트를 생성할 수 있어야 한다', async () => {
      // Given: 새 노트 정보
      const dto = {
        term: '새로운 용어',
        description: '설명입니다',
        example: '예시입니다',
      };
      const createdNote = createTestNote({
        id: 'new-note-id',
        userId,
        ...dto,
      });
      prisma.expressionNote.create.mockResolvedValue(createdNote);

      // When: 노트 생성
      const result = await service.create(userId, dto);

      // Then: 노트가 생성됨
      expect(result).toMatchObject({
        id: 'new-note-id',
        term: dto.term,
        description: dto.description,
        example: dto.example,
      });
      expect(prisma.expressionNote.create).toHaveBeenCalledWith({
        data: {
          userId,
          term: '새로운 용어',
          description: '설명입니다',
          example: '예시입니다',
        },
      });
    });

    it('description과 example은 선택적이어야 한다', async () => {
      // Given: term만 있는 노트
      const dto = {
        term: '용어만 있음',
      };
      const createdNote = createTestNote({
        id: 'new-note-id',
        userId,
        term: dto.term,
        description: null,
        example: null,
      });
      prisma.expressionNote.create.mockResolvedValue(createdNote);

      // When: 노트 생성
      await service.create(userId, dto);

      // Then: description과 example이 null로 저장됨
      expect(prisma.expressionNote.create).toHaveBeenCalledWith({
        data: {
          userId,
          term: '용어만 있음',
          description: null,
          example: null,
        },
      });
    });

    it('입력값의 앞뒤 공백을 제거해야 한다', async () => {
      // Given: 공백이 포함된 입력
      const dto = {
        term: '  공백 있음  ',
        description: '  설명  ',
        example: '  예시  ',
      };
      const createdNote = createTestNote({
        id: 'new-note-id',
        userId,
        term: '공백 있음',
        description: '설명',
        example: '예시',
      });
      prisma.expressionNote.create.mockResolvedValue(createdNote);

      // When: 노트 생성
      await service.create(userId, dto);

      // Then: 공백이 제거되어 저장됨
      expect(prisma.expressionNote.create).toHaveBeenCalledWith({
        data: {
          userId,
          term: '공백 있음',
          description: '설명',
          example: '예시',
        },
      });
    });

    it('빈 문자열은 null로 저장해야 한다', async () => {
      // Given: 빈 문자열
      const dto = {
        term: '용어',
        description: '   ',
        example: '',
      };
      const createdNote = createTestNote({
        id: 'new-note-id',
        userId,
        term: '용어',
        description: null,
        example: null,
      });
      prisma.expressionNote.create.mockResolvedValue(createdNote);

      // When: 노트 생성
      await service.create(userId, dto);

      // Then: null로 저장됨
      expect(prisma.expressionNote.create).toHaveBeenCalledWith({
        data: {
          userId,
          term: '용어',
          description: null,
          example: null,
        },
      });
    });
  });

  describe('노트 수정 (update)', () => {
    it('정상적으로 노트를 수정할 수 있어야 한다', async () => {
      // Given: 기존 노트와 수정할 정보
      const existingNote = createTestNote({ id: 'note-1', userId });
      prisma.expressionNote.findUnique.mockResolvedValue(existingNote);

      const dto = {
        term: '수정된 용어',
        description: '수정된 설명',
        example: '수정된 예시',
      };
      const updatedNote = createTestNote({
        id: 'note-1',
        userId,
        ...dto,
      });
      prisma.expressionNote.update.mockResolvedValue(updatedNote);

      // When: 노트 수정
      const result = await service.update('note-1', userId, dto);

      // Then: 노트가 수정됨
      expect(result).toMatchObject({
        term: dto.term,
        description: dto.description,
        example: dto.example,
      });
      expect(prisma.expressionNote.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: {
          term: '수정된 용어',
          description: '수정된 설명',
          example: '수정된 예시',
        },
      });
    });

    it('일부 필드만 수정할 수 있어야 한다', async () => {
      // Given: 기존 노트와 일부 필드만 수정
      const existingNote = createTestNote({ id: 'note-1', userId });
      prisma.expressionNote.findUnique.mockResolvedValue(existingNote);

      const dto = {
        term: '수정된 용어',
      };
      const updatedNote = createTestNote({
        id: 'note-1',
        userId,
        term: dto.term,
      });
      prisma.expressionNote.update.mockResolvedValue(updatedNote);

      // When: 일부 필드만 수정
      await service.update('note-1', userId, dto);

      // Then: 해당 필드만 업데이트됨
      expect(prisma.expressionNote.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: {
          term: '수정된 용어',
        },
      });
    });

    it('다른 사용자의 노트는 수정할 수 없어야 한다', async () => {
      // Given: 다른 사용자의 노트
      const otherNote = createTestNote({ id: 'note-1', userId: otherUserId });
      prisma.expressionNote.findUnique.mockResolvedValue(otherNote);

      const dto = { term: '수정 시도' };

      // When & Then: ForbiddenException 발생
      await expectToThrowAsync(
        () => service.update('note-1', userId, dto),
        ForbiddenException,
        '접근 권한이 없습니다',
      );

      expect(prisma.expressionNote.update).not.toHaveBeenCalled();
    });

    it('빈 문자열은 null로 업데이트해야 한다', async () => {
      // Given: 기존 노트
      const existingNote = createTestNote({ id: 'note-1', userId });
      prisma.expressionNote.findUnique.mockResolvedValue(existingNote);

      const dto = {
        description: '   ',
        example: '',
      };
      const updatedNote = createTestNote({
        id: 'note-1',
        userId,
        description: null,
        example: null,
      });
      prisma.expressionNote.update.mockResolvedValue(updatedNote);

      // When: 빈 문자열로 수정
      await service.update('note-1', userId, dto);

      // Then: null로 업데이트됨
      expect(prisma.expressionNote.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: {
          description: null,
          example: null,
        },
      });
    });
  });

  describe('노트 삭제 (remove)', () => {
    it('정상적으로 노트를 삭제할 수 있어야 한다', async () => {
      // Given: 존재하는 노트
      const note = createTestNote({ id: 'note-1', userId });
      prisma.expressionNote.findUnique.mockResolvedValue(note);
      prisma.expressionNote.delete.mockResolvedValue(note);

      // When: 노트 삭제
      await service.remove('note-1', userId);

      // Then: 노트가 삭제됨
      expect(prisma.expressionNote.delete).toHaveBeenCalledWith({
        where: { id: 'note-1' },
      });
    });

    it('다른 사용자의 노트는 삭제할 수 없어야 한다', async () => {
      // Given: 다른 사용자의 노트
      const otherNote = createTestNote({ id: 'note-1', userId: otherUserId });
      prisma.expressionNote.findUnique.mockResolvedValue(otherNote);

      // When & Then: ForbiddenException 발생
      await expectToThrowAsync(
        () => service.remove('note-1', userId),
        ForbiddenException,
        '접근 권한이 없습니다',
      );

      expect(prisma.expressionNote.delete).not.toHaveBeenCalled();
    });

    it('존재하지 않는 노트면 NotFoundException을 던진다', async () => {
      // Given: 존재하지 않는 노트
      prisma.expressionNote.findUnique.mockResolvedValue(null);

      // When & Then: NotFoundException 발생
      await expectToThrowAsync(
        () => service.remove('invalid-id', userId),
        NotFoundException,
        '용어를 찾을 수 없습니다',
      );

      expect(prisma.expressionNote.delete).not.toHaveBeenCalled();
    });
  });

  describe('즐겨찾기 토글 (toggleStar)', () => {
    it('즐겨찾기를 활성화할 수 있어야 한다', async () => {
      // Given: 즐겨찾기가 아닌 노트
      const note = createTestNote({
        id: 'note-1',
        userId,
        isStarred: false,
      });
      prisma.expressionNote.findUnique.mockResolvedValue(note);

      const starredNote = { ...note, isStarred: true };
      prisma.expressionNote.update.mockResolvedValue(starredNote);

      // When: 즐겨찾기 토글
      const result = await service.toggleStar('note-1', userId);

      // Then: 즐겨찾기가 활성화됨
      expect(result.isStarred).toBe(true);
      expect(prisma.expressionNote.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: { isStarred: true },
      });
    });

    it('즐겨찾기를 해제할 수 있어야 한다', async () => {
      // Given: 즐겨찾기인 노트
      const note = createTestNote({
        id: 'note-1',
        userId,
        isStarred: true,
      });
      prisma.expressionNote.findUnique.mockResolvedValue(note);

      const unstarredNote = { ...note, isStarred: false };
      prisma.expressionNote.update.mockResolvedValue(unstarredNote);

      // When: 즐겨찾기 토글
      const result = await service.toggleStar('note-1', userId);

      // Then: 즐겨찾기가 해제됨
      expect(result.isStarred).toBe(false);
      expect(prisma.expressionNote.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: { isStarred: false },
      });
    });

    it('다른 사용자의 노트는 토글할 수 없어야 한다', async () => {
      // Given: 다른 사용자의 노트
      const otherNote = createTestNote({
        id: 'note-1',
        userId: otherUserId,
        isStarred: false,
      });
      prisma.expressionNote.findUnique.mockResolvedValue(otherNote);

      // When & Then: ForbiddenException 발생
      await expectToThrowAsync(
        () => service.toggleStar('note-1', userId),
        ForbiddenException,
        '접근 권한이 없습니다',
      );

      expect(prisma.expressionNote.update).not.toHaveBeenCalled();
    });
  });
});
