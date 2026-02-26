import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailCodeDto {
  @ApiProperty({ example: 'user@example.com', description: '인증 코드를 받은 이메일 주소' })
  @IsEmail({}, { message: '유효한 이메일 주소를 입력해주세요.' })
  @IsNotEmpty({ message: '이메일은 필수 항목입니다.' })
  email: string;

  @ApiProperty({
    example: '123456',
    description: '이메일로 받은 6자리 인증 코드',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: '인증 코드는 필수 항목입니다.' })
  @Length(6, 6, { message: '인증 코드는 6자리 숫자입니다.' })
  code: string;
}
