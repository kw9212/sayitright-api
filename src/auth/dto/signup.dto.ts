import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @MinLength(8)
  @IsNotEmpty()
  password: string;

  @IsOptional()
  username?: string;
}
