import { IsString, IsEnum, IsOptional, IsBoolean, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateEmailDto {
  @ApiProperty({
    example: '안녕하세요, 내일 미팅 시간을 오후 3시로 변경하고 싶습니다.',
    description: '이메일로 변환할 초안 텍스트 (10~600자)',
    minLength: 10,
    maxLength: 600,
  })
  @IsString()
  @MinLength(10, { message: '이메일은 최소 10자 이상이어야 합니다.' })
  @MaxLength(600, { message: '이메일은 최대 600자까지 입력 가능합니다.' })
  draft: string;

  @ApiProperty({ enum: ['ko', 'en'], example: 'ko', description: '생성할 이메일 언어' })
  @IsEnum(['ko', 'en'])
  language: 'ko' | 'en';

  @ApiPropertyOptional({
    example: '직장 상사',
    description: '수신자와의 관계 (최대 50자)',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  relationship?: string;

  @ApiPropertyOptional({
    example: '일정 조율',
    description: '이메일 목적 (최대 50자)',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  purpose?: string;

  @ApiPropertyOptional({
    example: '정중하게',
    description: '이메일 톤/분위기 (최대 50자)',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string;

  @ApiPropertyOptional({
    enum: ['short', 'medium', 'long'],
    example: 'medium',
    description: '이메일 길이',
  })
  @IsOptional()
  @IsEnum(['short', 'medium', 'long'])
  length?: 'short' | 'medium' | 'long';

  @ApiPropertyOptional({ example: true, description: '이메일 작성 근거(rationale) 포함 여부' })
  @IsOptional()
  @IsBoolean()
  includeRationale?: boolean;
}

export class GenerateEmailResponseDto {
  @ApiProperty({
    example: '안녕하세요. 내일 미팅을 오후 3시로 변경하고자 합니다...',
    description: '생성된 이메일 본문',
  })
  email: string;

  @ApiPropertyOptional({
    example: '정중한 표현을 사용하여 일정 변경을 요청하였습니다.',
    description: '이메일 작성 근거 설명',
  })
  rationale?: string;

  @ApiProperty({
    description: '실제 적용된 필터 옵션',
    example: {
      language: 'ko',
      relationship: '직장 상사',
      purpose: '일정 조율',
      tone: '정중하게',
      length: 'medium',
    },
  })
  appliedFilters: {
    language: 'ko' | 'en';
    relationship?: string;
    purpose?: string;
    tone?: string;
    length?: string;
  };

  @ApiProperty({
    description: '사용량 메타데이터',
    example: { charactersUsed: 150, tokensUsed: 320, creditCharged: 1, remainingCredits: 49 },
  })
  metadata: {
    charactersUsed: number;
    tokensUsed: number;
    creditCharged: number;
    remainingCredits?: number;
  };
}
