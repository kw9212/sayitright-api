export type EmailGenerationRequest = {
  content: string;
  relationship?: string;
  purpose?: string;
  tone?: string;
  length?: string;
  language: 'ko' | 'en';
  includeRationale: boolean;
  previousEmail?: string;
  refinementFeedback?: string;
};

export type EmailGenerationResponse = {
  email: string;
  rationale?: string;
  tokensUsed: number;
};
