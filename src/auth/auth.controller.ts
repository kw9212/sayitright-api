import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { SendVerificationCodeDto } from './dto/send-verification-code.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import { EmailVerificationService } from '../email/email-verification.service';
import type { Request, Response } from 'express';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @Post('send-verification-code')
  @HttpCode(HttpStatus.OK)
  async sendVerificationCode(@Body() dto: SendVerificationCodeDto) {
    await this.emailVerificationService.sendVerificationCode(dto.email);
    return { message: '인증 코드가 이메일로 발송되었습니다.' };
  }

  @Post('verify-email-code')
  @HttpCode(HttpStatus.OK)
  async verifyEmailCode(@Body() dto: VerifyEmailCodeDto) {
    const verified = await this.emailVerificationService.verifyCode(dto.email, dto.code);
    return { verified };
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.authService.login(dto);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Number(process.env.JWT_REFRESH_TTL_SEC ?? 604800) * 1000,
    });

    return { accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token: string = req.cookies?.refreshToken;
    if (!token) throw new UnauthorizedException('Invalid credentials');

    const { accessToken, refreshToken } = await this.authService.refresh(token);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Number(process.env.JWT_REFRESH_TTL_SEC ?? 604800) * 1000,
    });

    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken: string = req.cookies?.refreshToken;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return;
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken: string = req.cookies?.refreshToken;
    if (refreshToken) {
      await this.authService.logoutAll(refreshToken);
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return;
  }
}
