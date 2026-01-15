import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { GetTemplatesQueryDto } from './dto/get-templates-query.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import {
  TemplateResponseDto,
  TemplateListResponseDto,
  TemplateListItemDto,
} from './dto/template-response.dto';
import { Prisma } from '@prisma/client';
import {
  PREDEFINED_TONES,
  PREDEFINED_RELATIONSHIPS,
  PREDEFINED_PURPOSES,
} from '../common/constants/filter-options';
import { canCreateTemplate, type UserTier } from './template-policy.config';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: GetTemplatesQueryDto): Promise<TemplateListResponseDto> {
    const where = this.buildWhereClause(userId, query);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const take = limit;

    const [templates, total] = await Promise.all([
      this.prisma.template.findMany({
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
      this.prisma.template.count({ where }),
    ]);

    const items = templates.map((template) => TemplateListItemDto.fromEntity(template));

    this.logger.log(`사용자 ${userId}의 Template ${items.length}개 조회 (총 ${total}개)`);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, userId: string): Promise<TemplateResponseDto> {
    const template = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      this.logger.warn(`Template ${id} 찾을 수 없음`);
      throw new NotFoundException('Template를 찾을 수 없습니다.');
    }

    if (template.userId !== userId) {
      this.logger.warn(`사용자 ${userId}가 Template ${id} 접근 시도 (소유자: ${template.userId})`);
      throw new ForbiddenException('이 Template에 접근할 권한이 없습니다.');
    }

    this.logger.log(`Template ${id} 조회 성공`);

    return TemplateResponseDto.fromEntity(template);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    await this.prisma.template.delete({
      where: { id },
    });

    this.logger.log(`Template ${id} 삭제 완료`);
  }

  private buildWhereClause(userId: string, query: GetTemplatesQueryDto): Prisma.TemplateWhereInput {
    if (query.from && query.to) {
      const fromDate = new Date(query.from);
      const toDate = new Date(query.to);

      if (fromDate > toDate) {
        throw new BadRequestException('시작 날짜는 종료 날짜보다 이를 수 없습니다.');
      }
    }

    const where: Prisma.TemplateWhereInput = {
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

  async create(
    userId: string,
    dto: CreateTemplateDto,
  ): Promise<{ id: string; message?: string; creditCharged?: number }> {
    if (dto.sourceArchiveId) {
      const existingTemplate = await this.prisma.template.findUnique({
        where: { sourceArchiveId: dto.sourceArchiveId },
        select: { id: true, createdAt: true },
      });

      if (existingTemplate) {
        this.logger.warn(
          `아카이브 ${dto.sourceArchiveId}는 이미 템플릿 ${existingTemplate.id}로 전환됨`,
        );
        throw new ConflictException(
          '이미 템플릿으로 전환된 아카이브입니다. 템플릿 페이지에서 확인하세요.',
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        tier: true,
        creditBalance: true,
      },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const currentCount = await this.prisma.template.count({
      where: { userId },
    });

    const tier = (user.tier || 'free') as UserTier;
    const policy = canCreateTemplate(tier, currentCount, user.creditBalance);

    if (!policy.allowed) {
      this.logger.warn(
        `사용자 ${userId} (tier: ${tier}, count: ${currentCount}) 템플릿 생성 거부: ${policy.message}`,
      );
      throw new ForbiddenException(policy.message);
    }

    let creditCharged = 0;
    if (policy.requiresCredit && policy.cost > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          creditBalance: {
            decrement: policy.cost,
          },
        },
      });

      await this.prisma.creditTransaction.create({
        data: {
          userId,
          amount: -policy.cost,
          status: 'completed',
          reason: '템플릿 저장',
        },
      });

      creditCharged = policy.cost;
      this.logger.log(`사용자 ${userId} 템플릿 생성으로 크레딧 ${policy.cost}개 차감`);
    }

    const preview = dto.content.length > 200 ? dto.content.substring(0, 197) + '...' : dto.content;

    try {
      const template = await this.prisma.template.create({
        data: {
          userId,
          sourceArchiveId: dto.sourceArchiveId || null,
          title: dto.title || null,
          content: dto.content,
          preview,
          tone: dto.tone,
          relationship: dto.relationship || null,
          purpose: dto.purpose || null,
          rationale: dto.rationale || null,
        },
      });

      this.logger.log(
        `사용자 ${userId} (tier: ${tier}) 템플릿 ${template.id} 생성 ` +
          `(count: ${currentCount + 1}, credit: ${creditCharged}, source: ${dto.sourceArchiveId || 'direct'})`,
      );

      return {
        id: template.id,
        message: policy.message,
        creditCharged,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (
          error.code === 'P2002' &&
          Array.isArray(error.meta?.target) &&
          error.meta.target.includes('sourceArchiveId')
        ) {
          this.logger.warn(`DB 레벨 중복 감지: 아카이브 ${dto.sourceArchiveId} 동시 전환 시도`);
          throw new ConflictException(
            '이미 템플릿으로 전환된 아카이브입니다. 템플릿 페이지에서 확인하세요.',
          );
        }
      }
      throw error;
    }
  }

  async update(id: string, userId: string, dto: UpdateTemplateDto): Promise<TemplateResponseDto> {
    await this.findOne(id, userId);

    const updateData: Prisma.TemplateUpdateInput = {};

    if (dto.title !== undefined) {
      updateData.title = dto.title || null;
    }
    if (dto.tone !== undefined) {
      updateData.tone = dto.tone;
    }
    if (dto.purpose !== undefined) {
      updateData.purpose = dto.purpose || null;
    }
    if (dto.relationship !== undefined) {
      updateData.relationship = dto.relationship || null;
    }
    if (dto.rationale !== undefined) {
      updateData.rationale = dto.rationale || null;
    }

    if (dto.content !== undefined) {
      updateData.content = dto.content;
      updateData.preview =
        dto.content.length > 200 ? dto.content.substring(0, 197) + '...' : dto.content;
    }

    const updated = await this.prisma.template.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`템플릿 ${id} 수정 완료`);

    return TemplateResponseDto.fromEntity(updated);
  }
}
