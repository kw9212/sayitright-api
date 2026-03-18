import type { AuthRequest } from '../common/types/auth-request.type';
import { UsersService } from './users.service';
import { Controller, Get, Put, Body, NotFoundException, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateTierDto } from './dto/update-tier.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: '인증 필요 (유효한 Access Token 없음)' })
@UseGuards(JwtAccessGuard)
@Controller('v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: '내 프로필 조회',
    description: '현재 로그인한 사용자의 정보를 반환합니다.',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1abc123' },
            email: { type: 'string', example: 'user@example.com' },
            username: { type: 'string', example: '홍길동', nullable: true },
            tier: { type: 'string', enum: ['free', 'premium'], example: 'free' },
            creditBalance: { type: 'number', example: 50 },
            authProvider: { type: 'string', example: 'local' },
            createdAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
            updatedAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: '사용자를 찾을 수 없음' })
  @Get('me')
  async me(@Req() req: AuthRequest) {
    const user = await this.usersService.findMeById(req.user.sub);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @ApiOperation({ summary: '내 프로필 수정', description: '닉네임 또는 비밀번호를 변경합니다.' })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1abc123' },
            email: { type: 'string', example: 'user@example.com' },
            username: { type: 'string', example: '홍길동', nullable: true },
            updatedAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          },
        },
      },
    },
  })
  @Put('me')
  async updateProfile(@Req() req: AuthRequest, @Body() dto: UpdateProfileDto) {
    const user = await this.usersService.updateProfile(req.user.sub, {
      username: dto.username,
      password: dto.password,
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      updatedAt: user.updatedAt,
    };
  }

  @ApiOperation({
    summary: '비밀번호 변경',
    description: '현재 비밀번호 확인 및 이메일 인증 코드 검증 후 비밀번호를 변경합니다.',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        message: { type: 'string', example: '비밀번호가 변경되었습니다.' },
      },
    },
  })
  @Put('me/password')
  async changePassword(@Req() req: AuthRequest, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(req.user.sub, {
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
      emailCode: dto.emailCode,
    });

    return { message: '비밀번호가 변경되었습니다.' };
  }

  @ApiOperation({
    summary: '플랜 등급 변경',
    description: '사용자의 플랜을 free 또는 premium으로 변경합니다.',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1abc123' },
            email: { type: 'string', example: 'user@example.com' },
            username: { type: 'string', example: '홍길동', nullable: true },
            tier: { type: 'string', enum: ['free', 'premium'], example: 'premium' },
            updatedAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          },
        },
      },
    },
  })
  @Put('me/tier')
  async updateTier(@Req() req: AuthRequest, @Body() dto: UpdateTierDto) {
    const user = await this.usersService.updateTier(req.user.sub, dto.tier);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      tier: user.tier,
      updatedAt: user.updatedAt,
    };
  }
}
