/**
 * Archive 보관 정책 설정
 *
 * 하이브리드 정책: 기간 + 개수 제한 (먼저 도달하는 쪽 적용)
 *
 * 예시:
 * - Free 유저: 최근 7일 또는 200개
 *   → 하루 50개씩 7일 = 350개 저장 → 200개로 제한 ✅
 * - Premium 유저: 최근 30일 또는 2000개
 *   → 여유로운 보관
 *
 */

export const ARCHIVE_POLICY = {
  free: {
    retentionDays: 7,
    maxCount: 200,
  },
  premium: {
    retentionDays: 30,
    maxCount: 2000,
  },
} as const;

export type UserTier = 'free' | 'premium';

export function getArchivePolicy(tier: UserTier) {
  return ARCHIVE_POLICY[tier];
}

export function getRetentionCutoffDate(days: number): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}
