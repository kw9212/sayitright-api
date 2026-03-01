import { Template } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TemplateResponseDto {
  @ApiProperty({ example: 'clx1abc123', description: '템플릿 ID' })
  id: string;

  @ApiPropertyOptional({ example: '팀장님께 일정 조율 요청' })
  title?: string;

  @ApiProperty({ example: '안녕하세요. 다음 주 미팅을 금요일 오후로 변경하고자 합니다...' })
  content: string;

  @ApiProperty({ example: '정중하게' })
  tone: string;

  @ApiPropertyOptional({ example: '일정 조율' })
  purpose?: string;

  @ApiPropertyOptional({ example: '팀원' })
  target?: string;

  @ApiPropertyOptional({ example: '직장 상사' })
  relationship?: string;

  @ApiPropertyOptional({ example: '정중한 표현으로 일정 변경을 요청하였습니다.' })
  rationale?: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  static fromEntity(template: Template): TemplateResponseDto {
    return {
      id: template.id,
      title: template.title || undefined,
      content: template.content,
      tone: template.tone,
      purpose: template.purpose || undefined,
      target: template.target || undefined,
      relationship: template.relationship || undefined,
      rationale: template.rationale || undefined,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}

export class TemplateListItemDto {
  @ApiProperty({ example: 'clx1abc123' })
  id: string;

  @ApiPropertyOptional({ example: '팀장님께 일정 조율 요청' })
  title?: string;

  @ApiProperty({
    example: '안녕하세요. 다음 주 미팅을...',
    description: '이메일 내용 미리보기 (최대 200자)',
  })
  preview: string;

  @ApiProperty({ example: '정중하게' })
  tone: string;

  @ApiPropertyOptional({ example: '일정 조율' })
  purpose?: string;

  @ApiPropertyOptional({ example: '팀원' })
  target?: string;

  @ApiPropertyOptional({ example: '직장 상사' })
  relationship?: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  static fromEntity(
    template: Pick<
      Template,
      'id' | 'title' | 'tone' | 'purpose' | 'target' | 'relationship' | 'createdAt' | 'updatedAt'
    > & {
      preview?: string | null;
      content?: string;
    },
  ): TemplateListItemDto {
    let preview = template.preview || '';
    if (!preview && template.content) {
      preview =
        template.content.length > 200
          ? template.content.substring(0, 197) + '...'
          : template.content;
    }

    return {
      id: template.id,
      title: template.title || undefined,
      preview: preview || '(내용 없음)',
      tone: template.tone,
      purpose: template.purpose || undefined,
      target: template.target || undefined,
      relationship: template.relationship || undefined,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}

export class TemplateListResponseDto {
  @ApiProperty({ type: [TemplateListItemDto] })
  items: TemplateListItemDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
