import { Archive } from '@prisma/client';

export class ArchiveResponseDto {
  id: string;
  title?: string;
  content: string;
  tone: string;
  purpose?: string;
  target?: string;
  relationship?: string;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(archive: Archive): ArchiveResponseDto {
    return {
      id: archive.id,
      title: archive.title || undefined,
      content: archive.content,
      tone: archive.tone,
      purpose: archive.purpose || undefined,
      target: archive.target || undefined,
      relationship: archive.relationship || undefined,
      createdAt: archive.createdAt,
      updatedAt: archive.updatedAt,
    };
  }
}

export class ArchiveListItemDto {
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
    archive: Pick<
      Archive,
      'id' | 'title' | 'tone' | 'purpose' | 'target' | 'relationship' | 'createdAt' | 'updatedAt'
    > & {
      preview?: string | null;
      content?: string;
    },
  ): ArchiveListItemDto {
    let preview = archive.preview || '';
    if (!preview && archive.content) {
      preview =
        archive.content.length > 200 ? archive.content.substring(0, 197) + '...' : archive.content;
    }

    return {
      id: archive.id,
      title: archive.title || undefined,
      preview: preview || '(내용 없음)',
      tone: archive.tone,
      purpose: archive.purpose || undefined,
      target: archive.target || undefined,
      relationship: archive.relationship || undefined,
      createdAt: archive.createdAt,
      updatedAt: archive.updatedAt,
    };
  }
}

export interface ArchiveListResponseDto {
  items: ArchiveListItemDto[];
  total: number;
  page: number;
  limit: number;
}
