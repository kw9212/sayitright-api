import { IsOptional, IsString, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetTemplatesQueryDto {
  @ApiPropertyOptional({ example: 1, description: '페이지 번호 (기본값: 1)', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '페이지는 정수여야 합니다.' })
  @Min(1, { message: '페이지는 1 이상이어야 합니다.' })
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: '페이지당 항목 수 (기본값: 20)',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit은 정수여야 합니다.' })
  @Min(1, { message: 'limit은 1 이상이어야 합니다.' })
  @Max(100, { message: 'limit은 100 이하여야 합니다.' })
  limit?: number = 20;

  @ApiPropertyOptional({ example: '미팅', description: '내용 검색어' })
  @IsOptional()
  @IsString({ message: '검색어는 문자열이어야 합니다.' })
  q?: string;

  @ApiPropertyOptional({ example: '정중하게', description: '톤 필터' })
  @IsOptional()
  @IsString({ message: '톤은 문자열이어야 합니다.' })
  tone?: string;

  @ApiPropertyOptional({ example: '직장 상사', description: '관계 필터' })
  @IsOptional()
  @IsString({ message: '관계는 문자열이어야 합니다.' })
  relationship?: string;

  @ApiPropertyOptional({ example: '일정 조율', description: '목적 필터' })
  @IsOptional()
  @IsString({ message: '목적은 문자열이어야 합니다.' })
  purpose?: string;

  @ApiPropertyOptional({ example: '2024-01-01', description: '시작 날짜 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: '시작 날짜는 YYYY-MM-DD 형식이어야 합니다.' })
  from?: string;

  @ApiPropertyOptional({ example: '2024-12-31', description: '종료 날짜 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: '종료 날짜는 YYYY-MM-DD 형식이어야 합니다.' })
  to?: string;
}
