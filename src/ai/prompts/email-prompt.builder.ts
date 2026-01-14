import { EmailGenerationRequest } from './prompt.types';

export class EmailPromptBuilder {
  private static getSystemPrompt(language: 'ko' | 'en'): string {
    const languageOption = language === 'ko' ? 'Korean' : 'English';

    return `You are an expert email writing assistant specializing in professional and personal correspondence.
              Your goal is to refine user input into well-structured, appropriate emails while maintaining the user's core message.
              Always respond in ${languageOption}.`;
  }

  /**
   * 사용자 프롬프트 생성
   *
   * @param request - 이메일 생성 요청
   * @returns 완성된 프롬프트
   */
  static buildUserPrompt(request: EmailGenerationRequest): string {
    const parts: string[] = [];
    const isKorean = request.language === 'ko';

    if (isKorean) {
      parts.push(`다음 내용을 바탕으로 이메일을 작성해주세요:\n"${request.content}"\n`);
    } else {
      parts.push(`Please write an email based on the following content:\n"${request.content}"\n`);
    }

    const constraints: string[] = [];

    if (request.relationship) {
      constraints.push(`- 수신자와의 관계: ${this.getRelationshipLabel(request.relationship)}`);
    }

    if (request.purpose) {
      constraints.push(`- 이메일 목적: ${this.getPurposeLabel(request.purpose)}`);
    }

    if (request.tone) {
      constraints.push(`- 톤: ${this.getToneLabel(request.tone)}`);
    }

    if (request.length) {
      constraints.push(`- 길이: ${this.getLengthLabel(request.length)}`);
    }

    if (constraints.length > 0) {
      const header = isKorean
        ? '\n다음 조건을 고려해주세요:'
        : '\nPlease consider the following conditions:';
      parts.push(`${header}\n${constraints.join('\n')}`);
    } else {
      const msg = isKorean
        ? '\n상황에 가장 적절한 형식으로 작성해주세요.'
        : '\nPlease write in the most appropriate format for the situation.';
      parts.push(msg);
    }

    if (request.includeRationale) {
      if (isKorean) {
        parts.push(
          `\n\n응답 형식:\n` +
            `1. 먼저 완성된 이메일을 작성하고\n` +
            `2. "---RATIONALE---" 구분자 다음에\n` +
            `3. 왜 이렇게 작성했는지 개선 근거를 상세히 설명해주세요.\n` +
            `   (어떤 표현을 선택했는지, 왜 그 톤을 사용했는지, 구조는 왜 이렇게 했는지 등)`,
        );
      } else {
        parts.push(
          `\n\nResponse format:\n` +
            `1. First, write the complete email\n` +
            `2. After the "---RATIONALE---" separator\n` +
            `3. Explain in detail why you wrote it this way.\n` +
            `4. Write only the explanation in Korean.\n` +
            `   (Which expressions you chose, why you used that tone, why you structured it this way, etc.)`,
        );
      }
    } else {
      const msg = isKorean
        ? '\n\n완성된 이메일만 작성해주세요.'
        : '\n\nPlease write only the completed email.';
      parts.push(msg);
    }

    return parts.join('');
  }

  static build(request: EmailGenerationRequest): { system: string; user: string } {
    return {
      system: this.getSystemPrompt(request.language),
      user: this.buildUserPrompt(request),
    };
  }

  private static getRelationshipLabel(value: string): string {
    const labels: Record<string, string> = {
      professor: '교수님',
      supervisor: '상사',
      colleague: '동료',
      client: '고객',
      friend: '친구',
      custom: '직접 입력',
    };
    return labels[value] || value;
  }

  private static getPurposeLabel(value: string): string {
    const labels: Record<string, string> = {
      request: '요청',
      apology: '사과',
      thank: '감사',
      inquiry: '문의',
      report: '보고',
      custom: '직접 입력',
    };
    return labels[value] || value;
  }

  private static getToneLabel(value: string): string {
    const labels: Record<string, string> = {
      formal: '격식있는',
      polite: '공손한',
      casual: '캐주얼',
      friendly: '친근한',
      custom: '직접 입력',
    };
    return labels[value] || value;
  }

  private static getLengthLabel(value: string): string {
    const labels: Record<string, string> = {
      short: '짧고 간결하게',
      medium: '적당한 길이로',
      long: '상세하게',
    };
    return labels[value] || value;
  }

  static parseResponse(aiResponse: string): { email: string; rationale?: string } {
    const separatorPattern =
      /[-=]{3,}\s*(RATIONALE|rationale|Rationale|피드백|FEEDBACK)\s*[-=]{3,}/i;
    const match = aiResponse.match(separatorPattern);

    if (match) {
      const parts = aiResponse.split(separatorPattern);
      return {
        email: parts[0].trim(),
        rationale: parts[parts.length - 1].trim(),
      };
    }

    return {
      email: aiResponse.trim(),
    };
  }
}
