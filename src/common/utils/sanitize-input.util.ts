import { BadRequestException, Logger } from '@nestjs/common';

export const INPUT_VALIDATION = {
  MAX_CUSTOM_INPUT_LENGTH: 50,
  MAX_DRAFT_LENGTH: 600,

  FORBIDDEN_PATTERNS: [
    /---[A-Z\s]+---/gi,
    /\[SYSTEM\]/gi,
    /\[ASSISTANT\]/gi,
    /ignore\s+(previous|all|above)/gi,
    /forget\s+(everything|instructions)/gi,
    /new\s+(role|instruction|system)/gi,
  ],

  ALLOWED_PATTERN: /^[\p{L}\p{N}\s.,!?'"()\-:/]+$/u,
};

/**
 * 직접 입력 필드 검증 및 정제
 * (관계, 목적, 톤 커스텀 입력)
 *
 * @param input - 사용자 입력
 * @returns 정제된 입력
 * @throws BadRequestException - 검증 실패 시
 */
export function sanitizeCustomInput(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new BadRequestException('입력이 비어있습니다.');
  }

  let sanitized = input.trim();

  if (!sanitized) {
    throw new BadRequestException('입력이 비어있습니다.');
  }

  if (sanitized.length > INPUT_VALIDATION.MAX_CUSTOM_INPUT_LENGTH) {
    throw new BadRequestException(
      `입력은 ${INPUT_VALIDATION.MAX_CUSTOM_INPUT_LENGTH}자 이내로 제한됩니다.`,
    );
  }

  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  sanitized = sanitized.replace(/\s+/g, ' ');

  for (const pattern of INPUT_VALIDATION.FORBIDDEN_PATTERNS) {
    if (pattern.test(sanitized)) {
      throw new BadRequestException('허용되지 않는 패턴이 포함되어 있습니다.');
    }
  }

  if (!INPUT_VALIDATION.ALLOWED_PATTERN.test(sanitized)) {
    throw new BadRequestException('허용되지 않는 특수 문자가 포함되어 있습니다.');
  }

  return sanitized;
}

/**
 * 이메일 초안(draft) 검증 및 정제
 *
 * @param draft - 이메일 초안
 * @param maxLength - 최대 길이 (티어별)
 * @returns 정제된 초안
 * @throws BadRequestException - 검증 실패 시
 */
export function sanitizeDraft(draft: string, maxLength: number): string {
  if (!draft || typeof draft !== 'string') {
    throw new BadRequestException('이메일 내용이 비어있습니다.');
  }

  let sanitized = draft.trim();

  if (sanitized.length > maxLength) {
    throw new BadRequestException(`이메일은 ${maxLength}자 이내로 제한됩니다.`);
  }

  if (sanitized.length < 10) {
    throw new BadRequestException('이메일은 최소 10자 이상이어야 합니다.');
  }

  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  sanitized = sanitized.replace(/ {2,}/g, ' ');

  for (const pattern of INPUT_VALIDATION.FORBIDDEN_PATTERNS) {
    if (pattern.test(sanitized)) {
      Logger.warn('[Security] Suspicious pattern detected in draft:', pattern);
      sanitized = sanitized.replace(pattern, '[removed]');
    }
  }

  return sanitized;
}

/**
 * 여러 커스텀 입력을 일괄 검증
 *
 * @param inputs - 검증할 입력들
 * @returns 정제된 입력들
 */
export function sanitizeCustomInputs(inputs: {
  relationship?: string;
  purpose?: string;
  tone?: string;
}): {
  relationship?: string;
  purpose?: string;
  tone?: string;
} {
  const sanitized: typeof inputs = {};

  if (inputs.relationship) {
    sanitized.relationship = sanitizeCustomInput(inputs.relationship);
  }

  if (inputs.purpose) {
    sanitized.purpose = sanitizeCustomInput(inputs.purpose);
  }

  if (inputs.tone) {
    sanitized.tone = sanitizeCustomInput(inputs.tone);
  }

  return sanitized;
}
