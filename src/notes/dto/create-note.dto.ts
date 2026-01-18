import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  term: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  example?: string;
}
