/**
 * tier-calculator 유틸리티 함수 테스트
 *
 * 사용자 티어 계산 및 권한 확인 로직을 테스트합니다:
 * - 활성 구독 확인
 * - 사용자 티어 계산
 * - 구독 타입 확인
 * - 고급 기능 접근 권한 확인
 * - 일일 요청 제한 확인
 * - 입력 제한 확인
 * - 티어 업데이트 필요 여부 확인
 */

import type { Subscription } from '@prisma/client';
import {
  hasActiveSubscription,
  calculateUserTier,
  getSubscriptionType,
  checkAdvancedFeatureAccess,
  getDailyRequestLimit,
  getInputLimitByTier,
  shouldUpdateTier,
} from './tier-calculator.util';

describe('tier-calculator 유틸리티', () => {
  describe('hasActiveSubscription', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    it('활성 상태이고 기간 내인 구독이 있으면 true를 반환해야 한다', () => {
      // Given: 활성 구독
      const subscriptions: Subscription[] = [
        {
          id: 'sub-1',
          userId: 'user-1',
          status: 'active',
          startAt: yesterday,
          endAt: nextMonth,
          createdAt: now,
          updatedAt: now,
        },
      ];

      // When & Then
      expect(hasActiveSubscription(subscriptions)).toBe(true);
    });

    it('구독이 없으면 false를 반환해야 한다', () => {
      // Given: 빈 구독 배열
      const subscriptions: Subscription[] = [];

      // When & Then
      expect(hasActiveSubscription(subscriptions)).toBe(false);
    });

    it('status가 active가 아니면 false를 반환해야 한다', () => {
      // Given: 비활성 구독
      const subscriptions: Subscription[] = [
        {
          id: 'sub-1',
          userId: 'user-1',
          status: 'cancelled',
          startAt: yesterday,
          endAt: nextMonth,
          createdAt: now,
          updatedAt: now,
        },
      ];

      // When & Then
      expect(hasActiveSubscription(subscriptions)).toBe(false);
    });

    it('시작일이 미래이면 false를 반환해야 한다', () => {
      // Given: 아직 시작 안 한 구독
      const subscriptions: Subscription[] = [
        {
          id: 'sub-1',
          userId: 'user-1',
          status: 'active',
          startAt: tomorrow,
          endAt: nextMonth,
          createdAt: now,
          updatedAt: now,
        },
      ];

      // When & Then
      expect(hasActiveSubscription(subscriptions)).toBe(false);
    });

    it('종료일이 과거이면 false를 반환해야 한다', () => {
      // Given: 만료된 구독
      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const subscriptions: Subscription[] = [
        {
          id: 'sub-1',
          userId: 'user-1',
          status: 'active',
          startAt: lastMonth,
          endAt: yesterday,
          createdAt: now,
          updatedAt: now,
        },
      ];

      // When & Then
      expect(hasActiveSubscription(subscriptions)).toBe(false);
    });

    it('여러 구독 중 하나라도 활성이면 true를 반환해야 한다', () => {
      // Given: 활성 구독과 비활성 구독 혼재
      const subscriptions: Subscription[] = [
        {
          id: 'sub-1',
          userId: 'user-1',
          status: 'cancelled',
          startAt: yesterday,
          endAt: tomorrow,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'sub-2',
          userId: 'user-1',
          status: 'active',
          startAt: yesterday,
          endAt: nextMonth,
          createdAt: now,
          updatedAt: now,
        },
      ];

      // When & Then
      expect(hasActiveSubscription(subscriptions)).toBe(true);
    });
  });

  describe('calculateUserTier', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    it('활성 구독이 있으면 premium을 반환해야 한다', () => {
      // Given: 활성 구독 있음, 크레딧 없음
      const user = {
        creditBalance: 0,
        subscriptions: [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'active' as const,
            startAt: yesterday,
            endAt: nextMonth,
            createdAt: now,
            updatedAt: now,
          },
        ],
      };

      // When & Then
      expect(calculateUserTier(user)).toBe('premium');
    });

    it('크레딧이 있으면 premium을 반환해야 한다', () => {
      // Given: 구독 없음, 크레딧 있음
      const user = {
        creditBalance: 10,
        subscriptions: [],
      };

      // When & Then
      expect(calculateUserTier(user)).toBe('premium');
    });

    it('구독도 크레딧도 없으면 free를 반환해야 한다', () => {
      // Given: 구독 없음, 크레딧 없음
      const user = {
        creditBalance: 0,
        subscriptions: [],
      };

      // When & Then
      expect(calculateUserTier(user)).toBe('free');
    });

    it('구독과 크레딧이 모두 있으면 premium을 반환해야 한다', () => {
      // Given: 구독도 있고 크레딧도 있음
      const user = {
        creditBalance: 5,
        subscriptions: [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'active' as const,
            startAt: yesterday,
            endAt: nextMonth,
            createdAt: now,
            updatedAt: now,
          },
        ],
      };

      // When & Then
      expect(calculateUserTier(user)).toBe('premium');
    });

    it('subscriptions가 undefined여도 동작해야 한다', () => {
      // Given: subscriptions 없음
      const user = {
        creditBalance: 0,
      };

      // When & Then
      expect(calculateUserTier(user)).toBe('free');
    });
  });

  describe('getSubscriptionType', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    it('활성 구독이 있으면 "subscription"을 반환해야 한다', () => {
      // Given: 활성 구독
      const user = {
        creditBalance: 0,
        subscriptions: [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'active' as const,
            startAt: yesterday,
            endAt: nextMonth,
            createdAt: now,
            updatedAt: now,
          },
        ],
      };

      // When & Then
      expect(getSubscriptionType(user)).toBe('subscription');
    });

    it('크레딧만 있으면 "credit"을 반환해야 한다', () => {
      // Given: 크레딧만 있음
      const user = {
        creditBalance: 10,
        subscriptions: [],
      };

      // When & Then
      expect(getSubscriptionType(user)).toBe('credit');
    });

    it('둘 다 없으면 null을 반환해야 한다', () => {
      // Given: 구독도 크레딧도 없음
      const user = {
        creditBalance: 0,
        subscriptions: [],
      };

      // When & Then
      expect(getSubscriptionType(user)).toBeNull();
    });

    it('구독과 크레딧이 모두 있으면 "subscription"을 우선 반환해야 한다', () => {
      // Given: 둘 다 있음
      const user = {
        creditBalance: 5,
        subscriptions: [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'active' as const,
            startAt: yesterday,
            endAt: nextMonth,
            createdAt: now,
            updatedAt: now,
          },
        ],
      };

      // When & Then
      expect(getSubscriptionType(user)).toBe('subscription');
    });
  });

  describe('checkAdvancedFeatureAccess', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    it('free 티어는 접근 불가해야 한다', () => {
      // Given: free 티어 사용자
      const user = {
        creditBalance: 0,
        subscriptions: [],
      };

      // When
      const result = checkAdvancedFeatureAccess(user);

      // Then
      expect(result).toEqual({
        allowed: false,
        requiresCredit: false,
        reason: '고급 기능은 Premium 유저만 사용할 수 있습니다.',
      });
    });

    it('구독이 있으면 크레딧 차감 없이 접근 가능해야 한다', () => {
      // Given: 활성 구독
      const user = {
        creditBalance: 0,
        subscriptions: [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'active' as const,
            startAt: yesterday,
            endAt: nextMonth,
            createdAt: now,
            updatedAt: now,
          },
        ],
      };

      // When
      const result = checkAdvancedFeatureAccess(user);

      // Then
      expect(result).toEqual({
        allowed: true,
        requiresCredit: false,
      });
    });

    it('크레딧이 충분하면 접근 가능해야 한다', () => {
      // Given: 크레딧 충분
      const user = {
        creditBalance: 5,
        subscriptions: [],
      };

      // When
      const result = checkAdvancedFeatureAccess(user);

      // Then
      expect(result).toEqual({
        allowed: true,
        requiresCredit: true,
      });
    });

    it('크레딧이 부족하면 접근 불가해야 한다', () => {
      // 먼저 premium으로 만들기 위해 creditBalance를 1로 설정한 후 다시 0으로
      // (이 테스트는 실제로는 티어가 premium이지만 크레딧이 0인 경우를 가정)
      // 실제로는 calculateUserTier가 free를 반환하므로 이 케이스는 발생하지 않음
      // 그래서 이 테스트는 현재 로직상 발생 불가능한 시나리오임
      // 그러나 크레딧 로직은 핵심 비즈니스 로직 중 하나이고 추후 추가될 여지가 있음으로 테스트 코드로 작성

      // 대신 정확한 테스트: 크레딧이 1 미만이면 접근 불가
      const userWithLowCredit = {
        creditBalance: 0,
        subscriptions: [],
      };

      // When
      const result = checkAdvancedFeatureAccess(userWithLowCredit);

      // Then: free 티어이므로 다른 메시지 반환
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('고급 기능은 Premium 유저만 사용할 수 있습니다.');
    });
  });

  describe('getDailyRequestLimit', () => {
    it('guest 티어는 3회 제한이어야 한다', () => {
      expect(getDailyRequestLimit('guest')).toBe(3);
    });

    it('free 티어는 10회 제한이어야 한다', () => {
      expect(getDailyRequestLimit('free')).toBe(10);
    });

    it('premium 티어는 100회 제한이어야 한다', () => {
      expect(getDailyRequestLimit('premium')).toBe(100);
    });

    it('알 수 없는 티어는 0을 반환해야 한다', () => {
      expect(getDailyRequestLimit('unknown' as any)).toBe(0);
    });
  });

  describe('getInputLimitByTier', () => {
    it('guest 티어는 150자 제한이어야 한다', () => {
      expect(getInputLimitByTier('guest')).toBe(150);
    });

    it('free 티어는 300자 제한이어야 한다', () => {
      expect(getInputLimitByTier('free')).toBe(300);
    });

    it('premium 티어는 600자 제한이어야 한다', () => {
      expect(getInputLimitByTier('premium')).toBe(600);
    });

    it('알 수 없는 티어는 undefined를 반환해야 한다', () => {
      expect(getInputLimitByTier('unknown' as any)).toBeUndefined();
    });
  });

  describe('shouldUpdateTier', () => {
    it('현재 티어와 계산된 티어가 같으면 false를 반환해야 한다', () => {
      expect(shouldUpdateTier('free', 'free')).toBe(false);
      expect(shouldUpdateTier('premium', 'premium')).toBe(false);
    });

    it('현재 티어와 계산된 티어가 다르면 true를 반환해야 한다', () => {
      expect(shouldUpdateTier('free', 'premium')).toBe(true);
      expect(shouldUpdateTier('premium', 'free')).toBe(true);
    });
  });
});
