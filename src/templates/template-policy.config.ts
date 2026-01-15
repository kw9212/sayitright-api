/**
 * Template 저장 정책 설정
 *
 * 티어별 정책:
 * - guest: 1개 (로그인 유도)
 * - free: 3개 (무료)
 * - premium (크레딧): 3개까지 무료, 4개부터 크레딧 1개씩 차감
 * - premium (구독): 무제한
 *
 * 중요: 구독 종료 후에도 이전에 만든 템플릿은 계속 볼 수 있음 (읽기 전용)
 */

export const TEMPLATE_POLICY = {
  guest: {
    freeCount: 1,
    creditCostPerTemplate: 0,
    message: '로그인하면 더 많은 템플릿을 저장할 수 있습니다.',
  },
  free: {
    freeCount: 3,
    creditCostPerTemplate: 1,
    message: '무료 한도를 초과했습니다. 크레딧을 사용하거나 구독하세요.',
  },
  premium: {
    freeCount: 3,
    creditCostPerTemplate: 1,
    message: '무료 한도를 초과했습니다. 크레딧 1개가 차감됩니다.',
  },
  subscription: {
    freeCount: Infinity,
    creditCostPerTemplate: 0,
    message: '구독 중에는 무제한으로 템플릿을 저장할 수 있습니다.',
  },
} as const;

export type UserTier = 'guest' | 'free' | 'premium' | 'subscription';

export function getTemplatePolicy(tier: UserTier) {
  return TEMPLATE_POLICY[tier];
}

export function canCreateTemplate(
  tier: UserTier,
  currentCount: number,
  creditBalance: number = 0,
): {
  allowed: boolean;
  requiresCredit: boolean;
  cost: number;
  message: string;
} {
  const policy = getTemplatePolicy(tier);

  if (currentCount < policy.freeCount) {
    return {
      allowed: true,
      requiresCredit: false,
      cost: 0,
      message: '템플릿을 저장할 수 있습니다.',
    };
  }

  const cost = policy.creditCostPerTemplate;

  if (tier === 'guest') {
    return {
      allowed: false,
      requiresCredit: false,
      cost: 0,
      message: policy.message,
    };
  }

  if (tier === 'subscription') {
    return {
      allowed: true,
      requiresCredit: false,
      cost: 0,
      message: policy.message,
    };
  }

  if (cost > 0) {
    if (creditBalance >= cost) {
      return {
        allowed: true,
        requiresCredit: true,
        cost,
        message: `크레딧 ${cost}개가 차감됩니다.`,
      };
    } else {
      return {
        allowed: false,
        requiresCredit: true,
        cost,
        message: '크레딧이 부족합니다. 크레딧을 충전하거나 구독하세요.',
      };
    }
  }

  return {
    allowed: false,
    requiresCredit: true,
    cost,
    message: policy.message,
  };
}
