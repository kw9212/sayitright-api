import { IsOptional, IsString, IsIn, IsNumberString } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetNotesQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['latest', 'oldest', 'term_asc', 'term_desc'])
  sort?: 'latest' | 'oldest' | 'term_asc' | 'term_desc';

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  @Transform(({ value }) => (value as string) || '10')
  limit?: string;
}
