import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '제목은 비어있을 수 없습니다.' })
  @MaxLength(255, { message: '제목은 255자 이내여야 합니다.' })
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '내용은 비어있을 수 없습니다.' })
  content?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '톤은 비어있을 수 없습니다.' })
  tone?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  rationale?: string;
}
