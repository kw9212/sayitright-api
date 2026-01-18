import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { GetNotesQueryDto } from './dto/get-notes-query.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NoteResponseDto, NoteListResponseDto } from './dto/note-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: GetNotesQueryDto): Promise<NoteListResponseDto> {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(userId, query);
    const orderBy = this.buildOrderByClause(query.sort);

    const [notes, total] = await Promise.all([
      this.prisma.expressionNote.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.expressionNote.count({ where }),
    ]);

    this.logger.log(`용어 목록 조회: userId=${userId}, page=${page}, total=${total}`);

    return new NoteListResponseDto(notes, page, limit, total);
  }

  async findOne(id: string, userId: string): Promise<NoteResponseDto> {
    const note = await this.prisma.expressionNote.findUnique({
      where: { id },
    });

    if (!note) {
      throw new NotFoundException('용어를 찾을 수 없습니다.');
    }

    if (note.userId !== userId) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }

    return NoteResponseDto.fromEntity(note);
  }

  async create(userId: string, dto: CreateNoteDto): Promise<NoteResponseDto> {
    const note = await this.prisma.expressionNote.create({
      data: {
        userId,
        term: dto.term.trim(),
        description: dto.description?.trim() || null,
        example: dto.example?.trim() || null,
      },
    });

    this.logger.log(`용어 생성: id=${note.id}, term="${note.term}"`);

    return NoteResponseDto.fromEntity(note);
  }

  async update(id: string, userId: string, dto: UpdateNoteDto): Promise<NoteResponseDto> {
    await this.findOne(id, userId);

    const updateData: Prisma.ExpressionNoteUpdateInput = {};

    if (dto.term !== undefined) {
      updateData.term = dto.term.trim();
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description?.trim() || null;
    }
    if (dto.example !== undefined) {
      updateData.example = dto.example?.trim() || null;
    }

    const updated = await this.prisma.expressionNote.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`용어 수정: id=${id}`);

    return NoteResponseDto.fromEntity(updated);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    await this.prisma.expressionNote.delete({
      where: { id },
    });

    this.logger.log(`용어 삭제: id=${id}`);
  }

  async toggleStar(id: string, userId: string): Promise<NoteResponseDto> {
    const note = await this.findOne(id, userId);

    const updated = await this.prisma.expressionNote.update({
      where: { id },
      data: {
        isStarred: !note.isStarred,
      },
    });

    this.logger.log(`용어 중요 표시 토글: id=${id}, isStarred=${updated.isStarred}`);

    return NoteResponseDto.fromEntity(updated);
  }

  private buildWhereClause(
    userId: string,
    query: GetNotesQueryDto,
  ): Prisma.ExpressionNoteWhereInput {
    const where: Prisma.ExpressionNoteWhereInput = { userId };

    if (query.q) {
      const searchTerm = query.q.trim();
      if (searchTerm) {
        where.OR = [
          { term: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { example: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }
    }

    return where;
  }

  private buildOrderByClause(sort?: string): Prisma.ExpressionNoteOrderByWithRelationInput[] {
    switch (sort) {
      case 'oldest':
        return [{ createdAt: 'asc' }];
      case 'term_asc':
        return [{ term: 'asc' }];
      case 'term_desc':
        return [{ term: 'desc' }];
      case 'latest':
      default:
        return [{ isStarred: 'desc' }, { createdAt: 'desc' }];
    }
  }
}
