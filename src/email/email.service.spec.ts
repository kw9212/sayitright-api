/**
 * EmailService 테스트
 *
 * 이메일 발송 서비스 테스트
 * - 인증 코드 이메일 발송
 * - 이메일 발송 실패 처리
 */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let mockTransporter: {
    sendMail: jest.Mock;
  };

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn(),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string | number> = {
                SMTP_HOST: 'smtp.test.com',
                SMTP_PORT: 587,
                SMTP_USER: 'test@test.com',
                SMTP_PASS: 'testpass',
                SMTP_FROM: 'noreply@test.com',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationCode', () => {
    it('인증 코드 이메일을 성공적으로 발송해야 한다', async () => {
      // Given: 이메일과 코드
      const email = 'user@example.com';
      const code = '123456';

      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      // When: 이메일 발송
      await service.sendVerificationCode(email, code);

      // Then: sendMail 호출됨
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@test.com',
        to: email,
        subject: '[SayItRight] 이메일 인증 코드',
        html: expect.stringContaining(code),
      });
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('10분간'),
        }),
      );
    });

    it('이메일 발송 실패 시 에러를 던져야 한다', async () => {
      // Given: 이메일 발송 실패
      const email = 'user@example.com';
      const code = '123456';

      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection failed'));

      // When & Then: 에러 발생
      await expect(service.sendVerificationCode(email, code)).rejects.toThrow(
        '이메일 발송에 실패했습니다.',
      );
    });

    it('여러 이메일을 순차적으로 발송할 수 있어야 한다', async () => {
      // Given: 여러 이메일
      const emails = ['user1@example.com', 'user2@example.com', 'user3@example.com'];
      const code = '123456';

      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      // When: 순차 발송
      for (const email of emails) {
        await service.sendVerificationCode(email, code);
      }

      // Then: 3번 호출됨
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
    });

    it('HTML 이메일에 코드가 포함되어야 한다', async () => {
      // Given: 이메일과 코드
      const email = 'user@example.com';
      const code = '987654';

      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      // When: 이메일 발송
      await service.sendVerificationCode(email, code);

      // Then: HTML에 코드 포함됨
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(code);
      expect(callArgs.html).toContain('이메일 인증');
      expect(callArgs.html).toContain('SayItRight');
    });

    it('다른 코드로 여러 번 발송할 수 있어야 한다', async () => {
      // Given: 같은 이메일, 다른 코드
      const email = 'user@example.com';
      const codes = ['111111', '222222', '333333'];

      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      // When: 여러 번 발송
      for (const code of codes) {
        await service.sendVerificationCode(email, code);
      }

      // Then: 각 코드가 포함되어 발송됨
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
      codes.forEach((code, index) => {
        const callArgs = mockTransporter.sendMail.mock.calls[index][0];
        expect(callArgs.html).toContain(code);
      });
    });
  });
});
