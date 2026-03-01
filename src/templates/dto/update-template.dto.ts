import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTemplateDto {
  @ApiPropertyOptional({
    example: '팀장님께 일정 조율 요청',
    description: '수정할 제목 (최대 255자)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '제목은 비어있을 수 없습니다.' })
  @MaxLength(255, { message: '제목은 255자 이내여야 합니다.' })
  title?: string;

  @ApiPropertyOptional({
    example: '안녕하세요. 다음 주 미팅을...',
    description: '수정할 이메일 본문',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '내용은 비어있을 수 없습니다.' })
  content?: string;

  @ApiPropertyOptional({ example: '정중하게', description: '수정할 이메일 톤' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '톤은 비어있을 수 없습니다.' })
  tone?: string;

  @ApiPropertyOptional({ example: '일정 조율' })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({ example: '직장 상사' })
  @IsOptional()
  @IsString()
  relationship?: string;

  @ApiPropertyOptional({ example: '정중한 표현으로 일정 변경을 요청하였습니다.' })
  @IsOptional()
  @IsString()
  rationale?: string;
}
