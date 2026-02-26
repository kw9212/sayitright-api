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
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { SendVerificationCodeDto } from './dto/send-verification-code.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import { EmailVerificationService } from '../email/email-verification.service';
import type { Request, Response } from 'express';

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @ApiOperation({
    summary: '이메일 인증 코드 발송',
    description: '회원가입 전 이메일 인증 코드를 발송합니다. 코드는 5분간 유효합니다.',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: '인증 코드가 이메일로 발송되었습니다.' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: '유효하지 않은 이메일 형식' })
  @Post('send-verification-code')
  @HttpCode(HttpStatus.OK)
  async sendVerificationCode(@Body() dto: SendVerificationCodeDto) {
    await this.emailVerificationService.sendVerificationCode(dto.email);
    return { message: '인증 코드가 이메일로 발송되었습니다.' };
  }

  @ApiOperation({ summary: '이메일 인증 코드 검증' })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        data: { type: 'object', properties: { verified: { type: 'boolean', example: true } } },
      },
    },
  })
  @ApiBadRequestResponse({ description: '잘못된 인증 코드 또는 만료된 코드' })
  @Post('verify-email-code')
  @HttpCode(HttpStatus.OK)
  async verifyEmailCode(@Body() dto: VerifyEmailCodeDto) {
    const verified = await this.emailVerificationService.verifyCode(dto.email, dto.code);
    return { verified };
  }

  @ApiOperation({ summary: '회원가입', description: '이메일 인증 완료 후 회원가입합니다.' })
  @ApiCreatedResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: { accessToken: { type: 'string', example: 'eyJhbGci...' } },
        },
      },
    },
  })
  @ApiConflictResponse({ description: '이미 사용 중인 이메일' })
  @ApiBadRequestResponse({ description: '유효성 검사 실패' })
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @ApiOperation({
    summary: '로그인',
    description: 'Access Token을 반환하고, Refresh Token을 HttpOnly 쿠키로 설정합니다.',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: { accessToken: { type: 'string', example: 'eyJhbGci...' } },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '이메일 또는 비밀번호 불일치' })
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

  @ApiOperation({
    summary: 'Access Token 재발급',
    description: 'refreshToken 쿠키를 사용해 새 Access Token과 Refresh Token을 발급합니다.',
  })
  @ApiCookieAuth('refreshToken')
  @ApiOkResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: { accessToken: { type: 'string', example: 'eyJhbGci...' } },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '유효하지 않거나 만료된 Refresh Token' })
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

  @ApiOperation({
    summary: '로그아웃',
    description: '현재 기기의 세션을 종료하고 refreshToken 쿠키를 삭제합니다.',
  })
  @ApiCookieAuth('refreshToken')
  @ApiOkResponse({
    schema: { properties: { ok: { type: 'boolean', example: true } } },
  })
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

  @ApiOperation({
    summary: '모든 기기 로그아웃',
    description: '해당 계정의 모든 세션을 종료합니다.',
  })
  @ApiCookieAuth('refreshToken')
  @ApiOkResponse({
    schema: { properties: { ok: { type: 'boolean', example: true } } },
  })
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
