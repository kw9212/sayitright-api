import { ExpressionNote } from '@prisma/client';

export class NoteResponseDto {
  id: string;
  term: string;
  description: string | null;
  example: string | null;
  isStarred: boolean;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(note: ExpressionNote): NoteResponseDto {
    return {
      id: note.id,
      term: note.term,
      description: note.description,
      example: note.example,
      isStarred: note.isStarred,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }
}

export class NoteListItemDto {
  id: string;
  term: string;
  description: string | null;
  example: string | null;
  isStarred: boolean;
  createdAt: Date;

  static fromEntity(note: ExpressionNote): NoteListItemDto {
    return {
      id: note.id,
      term: note.term,
      description: note.description,
      example: note.example,
      isStarred: note.isStarred,
      createdAt: note.createdAt,
    };
  }
}

export class NoteListResponseDto {
  notes: NoteListItemDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  constructor(notes: ExpressionNote[], page: number, limit: number, total: number) {
    this.notes = notes.map((note) => NoteListItemDto.fromEntity(note));
    this.pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
