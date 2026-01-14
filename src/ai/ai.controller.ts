import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateEmailDto, GenerateEmailResponseDto } from './dto/generate-email.dto';
import { JwtOptionalGuard } from '../auth/guards/jwt-optional.guard';
import type { AuthRequest } from '../common/types/auth-request.type';

@Controller('v1/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-email')
  @UseGuards(JwtOptionalGuard)
  async generateEmail(
    @Body() dto: GenerateEmailDto,
    @Req() req: AuthRequest,
  ): Promise<GenerateEmailResponseDto> {
    const userId = req.user?.sub;
    return await this.aiService.generateEmail(dto, userId);
  }
}
