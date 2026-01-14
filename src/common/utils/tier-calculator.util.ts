import type { User, Subscription } from '@prisma/client';

export type UserTier = 'free' | 'premium';
export type UserTierWithGuest = 'guest' | 'free' | 'premium';

export function hasActiveSubscription(subscriptions: Subscription[]): boolean {
  const now = new Date();
  return subscriptions.some(
    (sub) => sub.status === 'active' && new Date(sub.startAt) <= now && new Date(sub.endAt) > now,
  );
}

export function calculateUserTier(
  user: Pick<User, 'creditBalance'> & {
    subscriptions?: Subscription[];
  },
): UserTier {
  if (user.subscriptions && hasActiveSubscription(user.subscriptions)) {
    return 'premium';
  }

  if (user.creditBalance > 0) {
    return 'premium';
  }

  return 'free';
}

export function getSubscriptionType(
  user: Pick<User, 'creditBalance'> & {
    subscriptions?: Subscription[];
  },
): 'subscription' | 'credit' | null {
  if (user.subscriptions && hasActiveSubscription(user.subscriptions)) {
    return 'subscription';
  }

  if (user.creditBalance > 0) {
    return 'credit';
  }

  return null;
}

export function checkAdvancedFeatureAccess(
  user: Pick<User, 'creditBalance'> & {
    subscriptions?: Subscription[];
  },
): {
  allowed: boolean;
  requiresCredit: boolean;
  reason?: string;
} {
  const tier = calculateUserTier(user);

  if (tier === 'free') {
    return {
      allowed: false,
      requiresCredit: false,
      reason: '고급 기능은 Premium 유저만 사용할 수 있습니다.',
    };
  }

  const subType = getSubscriptionType(user);

  if (subType === 'subscription') {
    return {
      allowed: true,
      requiresCredit: false,
    };
  }

  if (subType === 'credit') {
    if (user.creditBalance < 1) {
      return {
        allowed: false,
        requiresCredit: true,
        reason: '크레딧이 부족합니다.',
      };
    }

    return {
      allowed: true,
      requiresCredit: true,
    };
  }

  return {
    allowed: false,
    requiresCredit: false,
    reason: '알 수 없는 오류가 발생했습니다.',
  };
}

export function getDailyRequestLimit(tier: UserTierWithGuest): number {
  switch (tier) {
    case 'guest':
      return 3;
    case 'free':
      return 10;
    case 'premium':
      return 100;
    default:
      return 0;
  }
}

export function getInputLimitByTier(tier: UserTierWithGuest): number {
  const limits = {
    guest: 150,
    free: 300,
    premium: 600,
  };

  return limits[tier];
}

export function shouldUpdateTier(currentTier: string, calculatedTier: UserTier): boolean {
  return currentTier !== calculatedTier;
}
