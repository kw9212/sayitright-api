import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiTooManyRequestsResponse,
  ApiBadRequestResponse,
  getSchemaPath,
  ApiExtraModels,
} from '@nestjs/swagger';
import { AiService } from './ai.service';
import { GenerateEmailDto, GenerateEmailResponseDto } from './dto/generate-email.dto';
import { JwtOptionalGuard } from '../auth/guards/jwt-optional.guard';
import { IpRateLimitGuard } from '../common/guards/ip-rate-limit.guard';
import type { AuthRequest } from '../common/types/auth-request.type';

@ApiTags('AI')
@ApiExtraModels(GenerateEmailResponseDto)
@Controller('v1/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @ApiOperation({
    summary: 'AI 이메일 생성',
    description:
      '초안 텍스트를 기반으로 AI가 완성된 이메일을 생성합니다.\n\n' +
      '- 로그인 사용자: 계정 크레딧 차감\n' +
      '- 비로그인 사용자: IP 기반 일일 요청 제한 적용',
  })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        data: { $ref: getSchemaPath(GenerateEmailResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({ description: '유효성 검사 실패 (draft 길이, language 값 등)' })
  @ApiTooManyRequestsResponse({ description: '요청 한도 초과 (비로그인 IP 제한)' })
  @Post('generate-email')
  @UseGuards(JwtOptionalGuard, IpRateLimitGuard)
  async generateEmail(
    @Body() dto: GenerateEmailDto,
    @Req() req: AuthRequest,
  ): Promise<GenerateEmailResponseDto> {
    const userId = req.user?.sub;
    return await this.aiService.generateEmail(dto, userId);
  }
}
