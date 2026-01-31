import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateEmailDto, GenerateEmailResponseDto } from './dto/generate-email.dto';
import { EmailPromptBuilder } from './prompts/email-prompt.builder';
import { sanitizeDraft, sanitizeCustomInputs } from '../common/utils/sanitize-input.util';
import {
  calculateUserTier,
  checkAdvancedFeatureAccess,
  getInputLimitByTier,
  type UserTierWithGuest,
} from '../common/utils/tier-calculator.util';
import { AI_CONFIG } from './ai-config';
import { UsageTrackingService } from '../common/services/usage-tracking.service';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usageTracking: UsageTrackingService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateEmail(dto: GenerateEmailDto, userId?: string): Promise<GenerateEmailResponseDto> {
    try {
      this.logger.log('[generateEmail] 요청 데이터:', {
        userId: userId || 'guest',
        draftLength: dto.draft?.length || 0,
        language: dto.language,
        relationship: dto.relationship,
        purpose: dto.purpose,
        tone: dto.tone,
        length: dto.length,
        includeRationale: dto.includeRationale,
      });

      const user = userId
        ? await this.prisma.user.findUnique({
            where: { id: userId },
            include: { subscriptions: true },
          })
        : null;

      const tier: UserTierWithGuest = user
        ? calculateUserTier({
            creditBalance: user.creditBalance,
            subscriptions: user.subscriptions,
          })
        : 'guest';

      // 고급 기능 사용 시 length에 따른 입력 제한 적용
      let maxInputLength = getInputLimitByTier(tier);
      if (dto.length) {
        const lengthLimits: Record<string, number> = {
          short: 150,
          medium: 300,
          long: 600,
        };
        maxInputLength = lengthLimits[dto.length] || maxInputLength;
      }

      this.logger.log(
        `[generateEmail] userId=${userId || 'guest'}, tier=${tier}, length=${dto.length || 'none'}, maxLength=${maxInputLength}`,
      );

      const sanitizedDraft = sanitizeDraft(dto.draft, maxInputLength);

      const sanitizedCustomInputs = sanitizeCustomInputs({
        relationship: dto.relationship,
        purpose: dto.purpose,
        tone: dto.tone,
      });

      const usesAdvancedFeatures = !!(dto.tone || dto.length || dto.includeRationale);

      if (user && tier !== 'guest') {
        const usageCheck = await this.usageTracking.checkUsageLimit(
          user.id,
          tier,
          usesAdvancedFeatures,
        );

        if (!usageCheck.allowed) {
          throw new ForbiddenException(
            usageCheck.reason || '오늘의 사용 횟수를 모두 사용했습니다.',
          );
        }

        if (usesAdvancedFeatures && tier === 'premium') {
          const access = checkAdvancedFeatureAccess({
            creditBalance: user.creditBalance,
            subscriptions: user.subscriptions,
          });

          if (!access.allowed && access.requiresCredit) {
            throw new ForbiddenException(access.reason || '크레딧이 부족합니다.');
          }
        }
      }
      const relationship = sanitizedCustomInputs.relationship || dto.relationship;
      const purpose = sanitizedCustomInputs.purpose || dto.purpose;
      const tone = sanitizedCustomInputs.tone || dto.tone;
      const length = dto.length;

      const appliedFilters = {
        language: dto.language,
        relationship: relationship && relationship.trim() !== '' ? relationship : undefined,
        purpose: purpose && purpose.trim() !== '' ? purpose : undefined,
        tone: tone && typeof tone === 'string' && tone.trim() !== '' ? tone : undefined,
        length: length && typeof length === 'string' && length.trim() !== '' ? length : undefined,
      };

      const includeRationale = usesAdvancedFeatures && !!dto.includeRationale;
      const prompts = EmailPromptBuilder.build({
        content: sanitizedDraft,
        relationship: appliedFilters.relationship,
        purpose: appliedFilters.purpose,
        tone: appliedFilters.tone,
        length: appliedFilters.length,
        language: dto.language,
        includeRationale,
      });

      const aiResponse = await this.callOpenAI(prompts);
      const { email, rationale } = EmailPromptBuilder.parseResponse(aiResponse.content);

      let creditCharged = 0;
      let remainingCredits: number | undefined;

      if (user && usesAdvancedFeatures) {
        const access = checkAdvancedFeatureAccess({
          creditBalance: user.creditBalance,
          subscriptions: user.subscriptions,
        });

        if (access.requiresCredit && access.allowed) {
          creditCharged = AI_CONFIG.USER_TIERS.premium.creditCostPerAdvanced || 1;
          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              creditBalance: {
                decrement: creditCharged,
              },
            },
          });

          await this.prisma.creditTransaction.create({
            data: {
              userId: user.id,
              amount: -creditCharged,
              status: 'completed',
              reason: '고급 이메일 생성',
            },
          });

          remainingCredits = user.creditBalance - creditCharged;
        } else if (!access.requiresCredit) {
          remainingCredits = user.creditBalance;
        }
      }

      if (user) {
        const preview = email.length > 200 ? email.substring(0, 197) + '...' : email;

        const archiveData = {
          userId: user.id,
          preview,
          content: email,
          rationale: includeRationale && rationale ? rationale : null,
          tone: appliedFilters.tone || 'neutral',
          purpose: appliedFilters.purpose,
          relationship: appliedFilters.relationship,
        };

        this.logger.log('[Archive Create] 필드 길이 체크:', {
          previewLength: preview?.length || 0,
          contentLength: email.length,
          rationaleLength: archiveData.rationale?.length || 0,
          toneLength: archiveData.tone?.length || 0,
          purposeLength: archiveData.purpose?.length || 0,
          relationshipLength: archiveData.relationship?.length || 0,
        });

        await this.prisma.archive.create({
          data: archiveData,
        });

        await this.usageTracking.incrementUsage(
          user.id,
          usesAdvancedFeatures,
          aiResponse.tokensUsed,
        );
      }

      return {
        email,
        rationale: includeRationale ? rationale : undefined,
        appliedFilters: {
          language: appliedFilters.language,
          relationship: appliedFilters.relationship,
          purpose: appliedFilters.purpose,
          tone: appliedFilters.tone,
          length: appliedFilters.length,
        },
        metadata: {
          charactersUsed: sanitizedDraft.length,
          tokensUsed: aiResponse.tokensUsed,
          creditCharged,
          remainingCredits,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error('이메일 생성 중 예상치 못한 오류 발생', error);
      throw new BadRequestException('이메일 생성 중 오류가 발생했습니다.');
    }
  }

  private async callOpenAI(prompts: {
    system: string;
    user: string;
  }): Promise<{ content: string; tokensUsed: number }> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: AI_CONFIG.MODEL.name || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: prompts.system,
          },
          {
            role: 'user',
            content: prompts.user,
          },
        ],
        temperature: AI_CONFIG.MODEL.temperature,
        top_p: AI_CONFIG.MODEL.topP,
        max_tokens: 1000,
      });

      const content = completion.choices[0]?.message?.content || '';
      const tokensUsed = completion.usage?.total_tokens || 0;

      this.logger.log(`OpenAI 토큰 사용량: ${tokensUsed}`);

      return {
        content,
        tokensUsed,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error('[generateEmail] 에러 발생:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n')[0],
        });
      } else {
        this.logger.error('[generateEmail] 알 수 없는 에러:', error);
      }

      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'statusCode' in error.response &&
        error.response.statusCode === 400
      ) {
        throw error;
      }

      const err = error as { code?: string; status?: number; message?: string };

      if (err.code === 'insufficient_quota' || err.status === 429) {
        throw new BadRequestException(
          '⚠️ OpenAI API 할당량이 부족합니다. 관리자에게 문의해주세요.',
        );
      }

      if (err.code === 'rate_limit_exceeded') {
        throw new BadRequestException(
          '⏱️ API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
        );
      }

      if (err.code === 'invalid_api_key') {
        throw new BadRequestException('🔑 API 키가 유효하지 않습니다.');
      }

      const errorMessage = err.message || 'AI 서비스에 일시적인 오류가 발생했습니다.';
      throw new BadRequestException(`❌ ${errorMessage}`);
    }
  }
}
