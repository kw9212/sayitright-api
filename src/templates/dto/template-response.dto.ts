import { Template } from '@prisma/client';

export class TemplateResponseDto {
  id: string;
  title?: string;
  content: string;
  tone: string;
  purpose?: string;
  target?: string;
  relationship?: string;
  rationale?: string;
  createdAt: Date;
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
  id: string;
  title?: string;
  preview: string;
  tone: string;
  purpose?: string;
  target?: string;
  relationship?: string;
  createdAt: Date;
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

export interface TemplateListResponseDto {
  items: TemplateListItemDto[];
  total: number;
  page: number;
  limit: number;
}
