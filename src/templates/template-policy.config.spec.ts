/**
 * Template Policy 테스트
 *
 * 템플릿 저장 정책 로직 테스트
 * - 티어별 무료 한도
 * - 크레딧 차감 로직
 * - 권한 체크
 */

import {
  TEMPLATE_POLICY,
  getTemplatePolicy,
  canCreateTemplate,
  UserTier,
} from './template-policy.config';

describe('Template Policy', () => {
  describe('TEMPLATE_POLICY 상수', () => {
    it('guest 정책이 정의되어 있어야 한다', () => {
      expect(TEMPLATE_POLICY.guest).toEqual({
        freeCount: 1,
        creditCostPerTemplate: 0,
        message: '로그인하면 더 많은 템플릿을 저장할 수 있습니다.',
      });
    });

    it('free 정책이 정의되어 있어야 한다', () => {
      expect(TEMPLATE_POLICY.free).toEqual({
        freeCount: 3,
        creditCostPerTemplate: 1,
        message: '무료 한도를 초과했습니다. 크레딧을 사용하거나 구독하세요.',
      });
    });

    it('premium 정책이 정의되어 있어야 한다', () => {
      expect(TEMPLATE_POLICY.premium).toEqual({
        freeCount: 3,
        creditCostPerTemplate: 1,
        message: '무료 한도를 초과했습니다. 크레딧 1개가 차감됩니다.',
      });
    });

    it('subscription 정책이 정의되어 있어야 한다', () => {
      expect(TEMPLATE_POLICY.subscription).toEqual({
        freeCount: Infinity,
        creditCostPerTemplate: 0,
        message: '구독 중에는 무제한으로 템플릿을 저장할 수 있습니다.',
      });
    });
  });

  describe('getTemplatePolicy', () => {
    it('guest 티어의 정책을 반환해야 한다', () => {
      const policy = getTemplatePolicy('guest');
      expect(policy.freeCount).toBe(1);
      expect(policy.creditCostPerTemplate).toBe(0);
    });

    it('free 티어의 정책을 반환해야 한다', () => {
      const policy = getTemplatePolicy('free');
      expect(policy.freeCount).toBe(3);
      expect(policy.creditCostPerTemplate).toBe(1);
    });

    it('premium 티어의 정책을 반환해야 한다', () => {
      const policy = getTemplatePolicy('premium');
      expect(policy.freeCount).toBe(3);
      expect(policy.creditCostPerTemplate).toBe(1);
    });

    it('subscription 티어의 정책을 반환해야 한다', () => {
      const policy = getTemplatePolicy('subscription');
      expect(policy.freeCount).toBe(Infinity);
      expect(policy.creditCostPerTemplate).toBe(0);
    });
  });

  describe('canCreateTemplate - Guest 티어', () => {
    const tier: UserTier = 'guest';

    it('첫 템플릿은 생성 가능해야 한다', () => {
      const result = canCreateTemplate(tier, 0, 0);

      expect(result.allowed).toBe(true);
      expect(result.requiresCredit).toBe(false);
      expect(result.cost).toBe(0);
    });

    it('2번째 템플릿은 생성 불가능해야 한다', () => {
      const result = canCreateTemplate(tier, 1, 0);

      expect(result.allowed).toBe(false);
      expect(result.requiresCredit).toBe(false);
      expect(result.message).toContain('로그인');
    });

    it('크레딧이 있어도 한도 초과 시 생성 불가능해야 한다', () => {
      const result = canCreateTemplate(tier, 1, 100);

      expect(result.allowed).toBe(false);
      expect(result.requiresCredit).toBe(false);
    });
  });

  describe('canCreateTemplate - Free 티어', () => {
    const tier: UserTier = 'free';

    it('3개까지는 무료로 생성 가능해야 한다', () => {
      expect(canCreateTemplate(tier, 0, 0).allowed).toBe(true);
      expect(canCreateTemplate(tier, 1, 0).allowed).toBe(true);
      expect(canCreateTemplate(tier, 2, 0).allowed).toBe(true);

      expect(canCreateTemplate(tier, 2, 0).requiresCredit).toBe(false);
    });

    it('4번째 템플릿은 크레딧이 필요해야 한다', () => {
      const result = canCreateTemplate(tier, 3, 0);

      expect(result.allowed).toBe(false);
      expect(result.requiresCredit).toBe(true);
      expect(result.cost).toBe(1);
      expect(result.message).toContain('크레딧이 부족합니다');
    });

    it('크레딧이 있으면 4번째 템플릿도 생성 가능해야 한다', () => {
      const result = canCreateTemplate(tier, 3, 1);

      expect(result.allowed).toBe(true);
      expect(result.requiresCredit).toBe(true);
      expect(result.cost).toBe(1);
      expect(result.message).toContain('크레딧 1개가 차감됩니다');
    });

    it('크레딧이 부족하면 생성 불가능해야 한다', () => {
      const result = canCreateTemplate(tier, 5, 0);

      expect(result.allowed).toBe(false);
      expect(result.requiresCredit).toBe(true);
    });
  });

  describe('canCreateTemplate - Premium 티어', () => {
    const tier: UserTier = 'premium';

    it('3개까지는 무료로 생성 가능해야 한다', () => {
      const result1 = canCreateTemplate(tier, 0, 0);
      const result2 = canCreateTemplate(tier, 1, 0);
      const result3 = canCreateTemplate(tier, 2, 0);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(true);
      expect(result3.requiresCredit).toBe(false);
    });

    it('4번째부터는 크레딧이 필요해야 한다', () => {
      const result = canCreateTemplate(tier, 3, 0);

      expect(result.allowed).toBe(false);
      expect(result.requiresCredit).toBe(true);
      expect(result.cost).toBe(1);
    });

    it('크레딧이 있으면 4번째 이상도 생성 가능해야 한다', () => {
      const result = canCreateTemplate(tier, 3, 5);

      expect(result.allowed).toBe(true);
      expect(result.requiresCredit).toBe(true);
      expect(result.cost).toBe(1);
      expect(result.message).toContain('크레딧 1개가 차감됩니다');
    });
  });

  describe('canCreateTemplate - Subscription 티어', () => {
    const tier: UserTier = 'subscription';

    it('무제한으로 생성 가능해야 한다', () => {
      expect(canCreateTemplate(tier, 0, 0).allowed).toBe(true);
      expect(canCreateTemplate(tier, 10, 0).allowed).toBe(true);
      expect(canCreateTemplate(tier, 100, 0).allowed).toBe(true);
      expect(canCreateTemplate(tier, 1000, 0).allowed).toBe(true);
    });

    it('크레딧이 필요하지 않아야 한다', () => {
      const result = canCreateTemplate(tier, 1000, 0);

      expect(result.requiresCredit).toBe(false);
      expect(result.cost).toBe(0);
    });

    it('크레딧이 없어도 생성 가능해야 한다', () => {
      const result = canCreateTemplate(tier, 500, 0);

      expect(result.allowed).toBe(true);
      expect(result.requiresCredit).toBe(false);
    });
  });

  describe('canCreateTemplate - 경계값 테스트', () => {
    it('free 티어 3번째 (마지막 무료) 생성 가능', () => {
      const result = canCreateTemplate('free', 2, 0);
      expect(result.allowed).toBe(true);
      expect(result.requiresCredit).toBe(false);
    });

    it('free 티어 4번째 (첫 유료) 크레딧 필요', () => {
      const result = canCreateTemplate('free', 3, 0);
      expect(result.allowed).toBe(false);
      expect(result.requiresCredit).toBe(true);
    });

    it('premium 티어 정확히 3개일 때 크레딧 필요', () => {
      const result = canCreateTemplate('premium', 3, 0);
      expect(result.allowed).toBe(false);
      expect(result.requiresCredit).toBe(true);
    });
  });
});
