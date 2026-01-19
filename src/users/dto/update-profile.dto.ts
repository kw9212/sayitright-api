import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: '닉네임은 2글자 이상이어야 합니다.' })
  @MaxLength(20, { message: '닉네임은 20글자 이하여야 합니다.' })
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  @MaxLength(72, { message: '비밀번호는 72자 이하여야 합니다.' })
  password?: string;
}
