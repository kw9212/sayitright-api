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
      maxAdvancedPerDay: 3,
      allowAdvanced: true,
      maxTokensPerRequest: 100,
      maxArchives: 10,
      maxTemplates: 3,
      maxExpressionNotes: 10,
    },
    free: {
      maxRequestsPerDay: 10,
      maxAdvancedPerDay: 5,
      allowAdvanced: true,
      maxTokensPerRequest: 200,
    },
    premium: {
      maxRequestsPerDay: 100,
      maxAdvancedPerDay: 100,
      allowAdvanced: true,
      maxTokensPerRequest: 400,
      creditCostPerAdvanced: 1,
    },
  },

  MODEL: {
    name: 'gpt-4o-mini',
    temperature: 0.7,
    topP: 0.9,
  },
};
