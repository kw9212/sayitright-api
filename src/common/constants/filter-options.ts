export const PREDEFINED_TONES = ['formal', 'polite', 'casual', 'friendly'] as const;

export const PREDEFINED_RELATIONSHIPS = [
  'professor',
  'supervisor',
  'colleague',
  'client',
  'friend',
] as const;

export const PREDEFINED_PURPOSES = ['request', 'apology', 'thank', 'inquiry', 'report'] as const;

export type ToneOption = (typeof PREDEFINED_TONES)[number];
export type RelationshipOption = (typeof PREDEFINED_RELATIONSHIPS)[number];
export type PurposeOption = (typeof PREDEFINED_PURPOSES)[number];
