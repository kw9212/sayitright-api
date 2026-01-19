import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyEmailCodeDto {
  @IsEmail({}, { message: '유효한 이메일 주소를 입력해주세요.' })
  @IsNotEmpty({ message: '이메일은 필수 항목입니다.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: '인증 코드는 필수 항목입니다.' })
  @Length(6, 6, { message: '인증 코드는 6자리 숫자입니다.' })
  code: string;
}
