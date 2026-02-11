/**
 * Archive Policy 테스트
 *
 * 아카이브 보관 정책 로직 테스트
 * - 티어별 보관 기간
 * - 최대 보관 개수
 * - 보관 기한 계산
 */

import { ARCHIVE_POLICY, getArchivePolicy, getRetentionCutoffDate } from './archive-policy.config';

describe('Archive Policy', () => {
  describe('ARCHIVE_POLICY 상수', () => {
    it('free 정책이 정의되어 있어야 한다', () => {
      expect(ARCHIVE_POLICY.free).toEqual({
        retentionDays: 7,
        maxCount: 200,
      });
    });

    it('premium 정책이 정의되어 있어야 한다', () => {
      expect(ARCHIVE_POLICY.premium).toEqual({
        retentionDays: 30,
        maxCount: 2000,
      });
    });
  });

  describe('getArchivePolicy', () => {
    it('free 티어의 정책을 반환해야 한다', () => {
      const policy = getArchivePolicy('free');

      expect(policy.retentionDays).toBe(7);
      expect(policy.maxCount).toBe(200);
    });

    it('premium 티어의 정책을 반환해야 한다', () => {
      const policy = getArchivePolicy('premium');

      expect(policy.retentionDays).toBe(30);
      expect(policy.maxCount).toBe(2000);
    });
  });

  describe('getRetentionCutoffDate', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-10T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('7일 전 날짜를 정확히 계산해야 한다', () => {
      // Given: 2026-02-10
      const cutoff = getRetentionCutoffDate(7);

      // Then: 2026-02-03 00:00:00
      expect(cutoff.getDate()).toBe(3);
      expect(cutoff.getMonth()).toBe(1); // 0-based (1 = February)
      expect(cutoff.getFullYear()).toBe(2026);
      expect(cutoff.getHours()).toBe(0);
      expect(cutoff.getMinutes()).toBe(0);
      expect(cutoff.getSeconds()).toBe(0);
    });

    it('30일 전 날짜를 정확히 계산해야 한다', () => {
      // Given: 2026-02-10
      const cutoff = getRetentionCutoffDate(30);

      // Then: 2026-01-11 00:00:00
      expect(cutoff.getDate()).toBe(11);
      expect(cutoff.getMonth()).toBe(0); // 0-based (0 = January)
      expect(cutoff.getFullYear()).toBe(2026);
    });

    it('1일 전 날짜를 계산해야 한다', () => {
      // Given: 2026-02-10
      const cutoff = getRetentionCutoffDate(1);

      // Then: 2026-02-09 00:00:00
      expect(cutoff.getDate()).toBe(9);
      expect(cutoff.getMonth()).toBe(1);
    });

    it('0일이면 오늘 00:00:00이어야 한다', () => {
      // Given: 2026-02-10 12:00:00
      const cutoff = getRetentionCutoffDate(0);

      // Then: 2026-02-10 00:00:00
      expect(cutoff.getDate()).toBe(10);
      expect(cutoff.getHours()).toBe(0);
      expect(cutoff.getMinutes()).toBe(0);
    });

    it('월을 넘어가는 날짜도 정확히 계산해야 한다', () => {
      // Given: 2026-03-05
      jest.setSystemTime(new Date('2026-03-05T12:00:00Z'));

      const cutoff = getRetentionCutoffDate(10);

      // Then: 2026-02-23 00:00:00
      expect(cutoff.getDate()).toBe(23);
      expect(cutoff.getMonth()).toBe(1); // February
    });

    it('연도를 넘어가는 날짜도 정확히 계산해야 한다', () => {
      // Given: 2026-01-05
      jest.setSystemTime(new Date('2026-01-05T12:00:00Z'));

      const cutoff = getRetentionCutoffDate(10);

      // Then: 2025-12-26 00:00:00
      expect(cutoff.getDate()).toBe(26);
      expect(cutoff.getMonth()).toBe(11); // December
      expect(cutoff.getFullYear()).toBe(2025);
    });
  });

  describe('Policy Integration 시나리오', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-10T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('free 티어 유저는 7일 전 데이터까지만 보관', () => {
      const policy = getArchivePolicy('free');
      const cutoff = getRetentionCutoffDate(policy.retentionDays);

      expect(cutoff.getDate()).toBe(3); // 2026-02-03
      expect(cutoff.getMonth()).toBe(1); // February
    });

    it('premium 티어 유저는 30일 전 데이터까지 보관', () => {
      const policy = getArchivePolicy('premium');
      const cutoff = getRetentionCutoffDate(policy.retentionDays);

      expect(cutoff.getDate()).toBe(11); // 2026-01-11
      expect(cutoff.getMonth()).toBe(0); // January
    });

    it('free 티어는 200개 제한이 있어야 한다', () => {
      const policy = getArchivePolicy('free');
      expect(policy.maxCount).toBe(200);
    });

    it('premium 티어는 2000개 제한이 있어야 한다', () => {
      const policy = getArchivePolicy('premium');
      expect(policy.maxCount).toBe(2000);
    });

    it('하이브리드 정책: free 티어는 7일 또는 200개 중 먼저 도달', () => {
      const policy = getArchivePolicy('free');

      // 7일 제한
      expect(policy.retentionDays).toBe(7);

      // 200개 제한
      expect(policy.maxCount).toBe(200);

      // 실제로는 둘 중 먼저 도달하는 조건이 적용됨
      // 예: 하루 50개씩 7일 = 350개 → 200개로 제한
    });

    it('하이브리드 정책: premium 티어는 30일 또는 2000개 중 먼저 도달', () => {
      const policy = getArchivePolicy('premium');

      // 30일 제한
      expect(policy.retentionDays).toBe(30);

      // 2000개 제한
      expect(policy.maxCount).toBe(2000);
    });
  });
});
