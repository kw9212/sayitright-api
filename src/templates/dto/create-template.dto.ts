import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateTemplateDto {
  @IsOptional()
  @IsString({ message: '제목은 문자열이어야 합니다.' })
  @MaxLength(255, { message: '제목은 255자 이하여야 합니다.' })
  title?: string;

  @IsString({ message: '내용은 문자열이어야 합니다.' })
  @MinLength(1, { message: '내용은 비어있을 수 없습니다.' })
  content: string;

  @IsString({ message: '톤은 문자열이어야 합니다.' })
  tone: string;

  @IsOptional()
  @IsString({ message: '관계는 문자열이어야 합니다.' })
  relationship?: string;

  @IsOptional()
  @IsString({ message: '목적은 문자열이어야 합니다.' })
  purpose?: string;

  @IsOptional()
  @IsString({ message: '피드백은 문자열이어야 합니다.' })
  rationale?: string;

  @IsOptional()
  @IsString({ message: '원본 아카이브 ID는 문자열이어야 합니다.' })
  sourceArchiveId?: string;
}
