import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiPropertyOptional({
    example: '팀장님께 일정 조율 요청',
    description: '템플릿 제목 (최대 255자)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: '제목은 문자열이어야 합니다.' })
  @MaxLength(255, { message: '제목은 255자 이하여야 합니다.' })
  title?: string;

  @ApiProperty({
    example: '안녕하세요. 다음 주 미팅을 금요일 오후로 변경하고자 합니다...',
    description: '이메일 본문',
  })
  @IsString({ message: '내용은 문자열이어야 합니다.' })
  @MinLength(1, { message: '내용은 비어있을 수 없습니다.' })
  content: string;

  @ApiProperty({ example: '정중하게', description: '이메일 톤' })
  @IsString({ message: '톤은 문자열이어야 합니다.' })
  tone: string;

  @ApiPropertyOptional({ example: '직장 상사', description: '수신자와의 관계' })
  @IsOptional()
  @IsString({ message: '관계는 문자열이어야 합니다.' })
  relationship?: string;

  @ApiPropertyOptional({ example: '일정 조율', description: '이메일 목적' })
  @IsOptional()
  @IsString({ message: '목적은 문자열이어야 합니다.' })
  purpose?: string;

  @ApiPropertyOptional({
    example: '정중한 표현으로 일정 변경을 요청하였습니다.',
    description: 'AI 작성 근거',
  })
  @IsOptional()
  @IsString({ message: '피드백은 문자열이어야 합니다.' })
  rationale?: string;

  @ApiPropertyOptional({
    example: 'clx1abc123',
    description: '원본 아카이브 ID (아카이브에서 템플릿 저장 시)',
  })
  @IsOptional()
  @IsString({ message: '원본 아카이브 ID는 문자열이어야 합니다.' })
  sourceArchiveId?: string;
}
