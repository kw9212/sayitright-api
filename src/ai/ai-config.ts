export const AI_CONFIG = {
  TOKEN_LIMITS: {
    short: {
      maxTokens: 100,
      description: '간결한 이메일 (~150자)',
    },
    medium: {
      maxTokens: 200,
      description: '일반적인 이메일 (~300자)',
    },
    long: {
      maxTokens: 400,
      description: '상세한 이메일 (~600자)',
    },
  },

  ADVANCED_BONUS_TOKENS: 300,

  USER_TIERS: {
    guest: {
      maxRequestsPerDay: 3,
      allowAdvanced: true,
      maxTokensPerRequest: 100,
    },
    free: {
      maxRequestsPerDay: 10,
      allowAdvanced: false,
      maxTokensPerRequest: 200,
    },
    premium: {
      maxRequestsPerDay: 100,
      allowAdvanced: true,
      maxTokensPerRequest: 400,
      creditCostPerAdvanced: 1,
    },
  },

  MODEL: {
    name: 'gpt-5-mini',
    temperature: 0.7,
    topP: 0.9,
  },
};

export function getMaxTokens(
  userTier: 'guest' | 'free' | 'premium',
  length: 'short' | 'medium' | 'long',
  includeRationale: boolean,
): number {
  const tierConfig = AI_CONFIG.USER_TIERS[userTier];
  const lengthConfig = AI_CONFIG.TOKEN_LIMITS[length];

  let maxTokens = lengthConfig.maxTokens;

  if (includeRationale) {
    maxTokens += AI_CONFIG.ADVANCED_BONUS_TOKENS;
  }

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
  const PROMPT_OVERHEAD = 150;

  const inputTokens = totalTokens - outputTokens - PROMPT_OVERHEAD;

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
