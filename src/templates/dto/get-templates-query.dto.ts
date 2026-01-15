import { IsOptional, IsString, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetTemplatesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '페이지는 정수여야 합니다.' })
  @Min(1, { message: '페이지는 1 이상이어야 합니다.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit은 정수여야 합니다.' })
  @Min(1, { message: 'limit은 1 이상이어야 합니다.' })
  @Max(100, { message: 'limit은 100 이하여야 합니다.' })
  limit?: number = 20;

  @IsOptional()
  @IsString({ message: '검색어는 문자열이어야 합니다.' })
  q?: string;

  @IsOptional()
  @IsString({ message: '톤은 문자열이어야 합니다.' })
  tone?: string;

  @IsOptional()
  @IsString({ message: '관계는 문자열이어야 합니다.' })
  relationship?: string;

  @IsOptional()
  @IsString({ message: '목적은 문자열이어야 합니다.' })
  purpose?: string;

  @IsOptional()
  @IsDateString({}, { message: '시작 날짜는 YYYY-MM-DD 형식이어야 합니다.' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: '종료 날짜는 YYYY-MM-DD 형식이어야 합니다.' })
  to?: string;
}
