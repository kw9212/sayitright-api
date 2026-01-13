export const AI_CONFIG = {
  TOKEN_LIMITS: {
    short: {
      maxTokens: 300,
      description: '간결한 이메일 (2-3 문단)',
    },
    medium: {
      maxTokens: 500,
      description: '일반적인 이메일 (3-5 문단)',
    },
    long: {
      maxTokens: 1000,
      description: '상세한 이메일 (5-8 문단)',
    },
  },

  // 고급 기능 보너스
  ADVANCED_BONUS_TOKENS: 500,

  // 사용자 등급별 제한
  USER_TIERS: {
    guest: {
      maxRequestsPerDay: 3,
      allowAdvanced: true,
      maxTokensPerRequest: 500,
    },
    free: {
      maxRequestsPerDay: 10,
      allowAdvanced: false,
      maxTokensPerRequest: 500,
    },
    premium: {
      maxRequestsPerDay: 100,
      allowAdvanced: true,
      maxTokensPerRequest: 1500,
      creditCostPerAdvanced: 1,
    },
  },

  // AI 모델 설정
  MODEL: {
    name: 'gpt-5-mini',
    temperature: 0.7,
    topP: 0.9,
  },
};

// 사용자 등급에 따른 최대 토큰 계산
export function getMaxTokens(
  userTier: 'guest' | 'free' | 'premium',
  length: 'short' | 'medium' | 'long',
  includeRationale: boolean,
): number {
  const tierConfig = AI_CONFIG.USER_TIERS[userTier];
  const lengthConfig = AI_CONFIG.TOKEN_LIMITS[length];

  let maxTokens = lengthConfig.maxTokens;

  // 고급 기능 사용 시 보너스 추가
  if (includeRationale) {
    maxTokens += AI_CONFIG.ADVANCED_BONUS_TOKENS;
  }

  // 사용자 등급 제한 적용
  return Math.min(maxTokens, tierConfig.maxTokensPerRequest);
}

/**
 * 입력 가능한 최대 글자수 계산
 *
 * @param totalTokens - 전체 사용 가능 토큰
 * @param outputTokens - 출력에 사용할 토큰
 * @param language - 언어 (한국어/영어)
 * @returns 입력 가능한 대략적 글자수
 */
export function getMaxInputCharacters(
  totalTokens: number,
  outputTokens: number,
  language: 'ko' | 'en',
): number {
  // 프롬프트 오버헤드 (시스템 프롬프트 + 필터 설명 등)
  const PROMPT_OVERHEAD = 150;

  // 입력에 사용 가능한 토큰
  const inputTokens = totalTokens - outputTokens - PROMPT_OVERHEAD;

  // 언어별 토큰당 글자수
  if (language === 'ko') {
    // 한국어: 1 토큰 ≈ 1.5~2 글자 (보수적으로 1.5)
    return Math.floor(inputTokens * 1.5);
  } else {
    // 영어: 1 토큰 ≈ 4 글자
    return Math.floor(inputTokens * 4);
  }
}

/**
 * 입력 제한 정보 조회
 *
 * @param userTier - 사용자 등급
 * @param length - 이메일 길이
 * @param includeRationale - 근거 포함 여부
 * @param language - 언어
 * @returns 입력 제한 정보
 */
export function getInputLimits(
  userTier: 'guest' | 'free' | 'premium',
  length: 'short' | 'medium' | 'long',
  includeRationale: boolean,
  language: 'ko' | 'en',
): {
  maxCharacters: number;
  estimatedOutputCharacters: number;
  totalTokens: number;
} {
  const totalTokens = getMaxTokens(userTier, length, includeRationale);
  const outputTokens = AI_CONFIG.TOKEN_LIMITS[length].maxTokens;

  return {
    maxCharacters: getMaxInputCharacters(totalTokens, outputTokens, language),
    estimatedOutputCharacters:
      language === 'ko' ? Math.floor(outputTokens * 1.5) : Math.floor(outputTokens * 4),
    totalTokens,
  };
}
