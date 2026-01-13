export type EmailGenerationRequest = {
  content: string;
  relationship?: string;
  purpose?: string;
  tone?: string;
  length?: string;
  language: 'ko' | 'en';
  includeRationale: boolean;
};

export type EmailGenerationResponse = {
  email: string;
  rationale?: string;
  tokensUsed: number;
};
