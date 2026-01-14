import { IsString, IsEnum, IsOptional, IsBoolean, MaxLength, MinLength } from 'class-validator';

export class GenerateEmailDto {
  @IsString()
  @MinLength(10, { message: '이메일은 최소 10자 이상이어야 합니다.' })
  @MaxLength(600, { message: '이메일은 최대 600자까지 입력 가능합니다.' })
  draft: string;

  @IsEnum(['ko', 'en'])
  language: 'ko' | 'en';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  relationship?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string;

  @IsOptional()
  @IsEnum(['short', 'medium', 'long'])
  length?: 'short' | 'medium' | 'long';

  @IsOptional()
  @IsBoolean()
  includeRationale?: boolean;
}

export class GenerateEmailResponseDto {
  email: string;
  rationale?: string;
  appliedFilters: {
    language: 'ko' | 'en';
    relationship?: string;
    purpose?: string;
    tone?: string;
    length?: string;
  };
  metadata: {
    charactersUsed: number;
    tokensUsed: number;
    creditCharged: number;
    remainingCredits?: number;
  };
}
