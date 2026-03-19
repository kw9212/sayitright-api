import { IsEmail, IsString, MinLength, MaxLength, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: '비밀번호를 재설정할 계정의 이메일',
  })
  @IsEmail({}, { message: '유효한 이메일 형식이 아닙니다.' })
  email: string;

  @ApiProperty({
    example: '123456',
    description: '이메일로 받은 6자리 인증 코드',
  })
  @IsString()
  @Length(6, 6, { message: '인증 코드는 6자리여야 합니다.' })
  emailCode: string;

  @ApiProperty({
    example: 'newpassword123',
    description: '새 비밀번호 (8~72자)',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  @MaxLength(72, { message: '비밀번호는 72자 이하여야 합니다.' })
  newPassword: string;
}
