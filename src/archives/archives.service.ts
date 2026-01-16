import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { GetArchivesQueryDto } from './dto/get-archives-query.dto';
import {
  ArchiveResponseDto,
  ArchiveListResponseDto,
  ArchiveListItemDto,
} from './dto/archive-response.dto';
import { Prisma } from '@prisma/client';
import { getArchivePolicy, getRetentionCutoffDate, type UserTier } from './archive-policy.config';
import {
  PREDEFINED_TONES,
  PREDEFINED_RELATIONSHIPS,
  PREDEFINED_PURPOSES,
} from '../common/constants/filter-options';

@Injectable()
export class ArchivesService {
  private readonly logger = new Logger(ArchivesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: GetArchivesQueryDto): Promise<ArchiveListResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });
    const tier = (user?.tier || 'free') as UserTier;

    void this.cleanupOldArchives(userId, tier);

    const where = this.buildWhereClause(userId, query);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const take = limit;

    const [archives, total] = await Promise.all([
      this.prisma.archive.findMany({
        where,
        select: {
          id: true,
          title: true,
          preview: true,
          tone: true,
          purpose: true,
          target: true,
          relationship: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.archive.count({ where }),
    ]);

    const items = archives.map((archive) => ArchiveListItemDto.fromEntity(archive));

    this.logger.log(`사용자 ${userId}의 Archive ${items.length}개 조회 (총 ${total}개)`);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, userId: string): Promise<ArchiveResponseDto> {
    const archive = await this.prisma.archive.findUnique({
      where: { id },
    });

    if (!archive) {
      this.logger.warn(`Archive ${id} 찾을 수 없음`);
      throw new NotFoundException('Archive를 찾을 수 없습니다.');
    }

    if (archive.userId !== userId) {
      this.logger.warn(`사용자 ${userId}가 Archive ${id} 접근 시도 (소유자: ${archive.userId})`);
      throw new ForbiddenException('이 Archive에 접근할 권한이 없습니다.');
    }

    this.logger.log(`Archive ${id} 조회 성공`);

    return ArchiveResponseDto.fromEntity(archive);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    await this.prisma.archive.delete({
      where: { id },
    });

    this.logger.log(`Archive ${id} 삭제 완료`);
  }

  private buildWhereClause(userId: string, query: GetArchivesQueryDto): Prisma.ArchiveWhereInput {
    if (query.from && query.to) {
      const fromDate = new Date(query.from);
      const toDate = new Date(query.to);

      if (fromDate > toDate) {
        throw new BadRequestException('시작 날짜는 종료 날짜보다 이를 수 없습니다.');
      }
    }

    const where: Prisma.ArchiveWhereInput = {
      userId,
    };

    if (query.q) {
      const searchTerm = query.q.trim();
      this.logger.log(`[검색어] "${searchTerm}" 검색 중... (원본: "${query.q}")`);

      if (searchTerm) {
        where.OR = [
          { content: { contains: searchTerm, mode: 'insensitive' } },
          { title: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }
    }

    if (query.tone) {
      if (query.tone === '__other__') {
        where.tone = { notIn: [...PREDEFINED_TONES] };
      } else {
        where.tone = query.tone;
      }
    }

    if (query.relationship) {
      if (query.relationship === '__other__') {
        where.relationship = { notIn: [...PREDEFINED_RELATIONSHIPS] };
      } else {
        where.relationship = query.relationship;
      }
    }

    if (query.purpose) {
      if (query.purpose === '__other__') {
        where.purpose = { notIn: [...PREDEFINED_PURPOSES] };
      } else {
        where.purpose = query.purpose;
      }
    }

    if (query.from || query.to) {
      where.createdAt = {};

      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }

      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    return where;
  }

  async cleanupOldArchives(userId: string, tier: UserTier): Promise<number> {
    const policy = getArchivePolicy(tier);

    const cutoffDate = getRetentionCutoffDate(policy.retentionDays);
    const deletedByDate = await this.prisma.archive.deleteMany({
      where: {
        userId,
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(
      `사용자 ${userId}: 기간 초과 데이터 ${deletedByDate.count}개 삭제 (${policy.retentionDays}일 이전)`,
    );

    const currentCount = await this.prisma.archive.count({
      where: { userId },
    });

    if (currentCount > policy.maxCount) {
      const excessCount = currentCount - policy.maxCount;

      const oldArchives = await this.prisma.archive.findMany({
        where: { userId },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: excessCount,
      });

      const deletedByCount = await this.prisma.archive.deleteMany({
        where: {
          id: { in: oldArchives.map((a) => a.id) },
        },
      });

      this.logger.log(
        `사용자 ${userId}: 개수 초과 데이터 ${deletedByCount.count}개 삭제 (${policy.maxCount}개 제한)`,
      );

      return deletedByDate.count + deletedByCount.count;
    }

    return deletedByDate.count;
  }
}
