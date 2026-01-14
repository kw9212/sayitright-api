import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { AI_CONFIG } from '../../ai/ai-config';

@Injectable()
export class UsageTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  private getTodayString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  async getTodayUsage(userId: string) {
    const today = this.getTodayString();

    let usage = await this.prisma.usageTracking.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    if (!usage) {
      usage = await this.prisma.usageTracking.create({
        data: {
          userId,
          date: today,
          basicRequests: 0,
          advancedRequests: 0,
          totalTokensUsed: 0,
        },
      });
    }

    return usage;
  }

  async checkUsageLimit(
    userId: string,
    userTier: 'free' | 'premium',
    isAdvanced: boolean,
  ): Promise<{
    allowed: boolean;
    reason?: string;
    remaining?: number;
  }> {
    const usage = await this.getTodayUsage(userId);
    const tierConfig = AI_CONFIG.USER_TIERS[userTier];

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscriptions: true },
    });

    const hasActiveSubscription = user?.subscriptions.some(
      (sub) => sub.status === 'active' && new Date(sub.endAt) > new Date(),
    );

    if (hasActiveSubscription) {
      return { allowed: true };
    }

    if (isAdvanced) {
      const limit = tierConfig.maxAdvancedPerDay || tierConfig.maxRequestsPerDay;
      const current = usage.advancedRequests;

      if (current >= limit) {
        return {
          allowed: false,
          reason: `오늘의 고급 기능 사용 횟수를 모두 사용했습니다. (${limit}회/일)`,
          remaining: 0,
        };
      }

      return {
        allowed: true,
        remaining: limit - current,
      };
    }

    const limit = tierConfig.maxRequestsPerDay;
    const current = usage.basicRequests + usage.advancedRequests;

    if (current >= limit) {
      return {
        allowed: false,
        reason: `오늘의 사용 횟수를 모두 사용했습니다. (${limit}회/일)`,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      remaining: limit - current,
    };
  }

  async incrementUsage(userId: string, isAdvanced: boolean, tokensUsed: number): Promise<void> {
    const today = this.getTodayString();

    await this.prisma.usageTracking.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      create: {
        userId,
        date: today,
        basicRequests: isAdvanced ? 0 : 1,
        advancedRequests: isAdvanced ? 1 : 0,
        totalTokensUsed: tokensUsed,
      },
      update: {
        basicRequests: isAdvanced ? undefined : { increment: 1 },
        advancedRequests: isAdvanced ? { increment: 1 } : undefined,
        totalTokensUsed: { increment: tokensUsed },
      },
    });
  }

  async getUsageStats(userId: string, days: number = 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await this.prisma.usageTracking.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    return stats;
  }
}
