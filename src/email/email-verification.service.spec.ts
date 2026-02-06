/**
 * EmailVerificationService 테스트
 *
 * 이메일 인증 코드 생성 및 검증 로직을 테스트
 * - 인증 코드 생성 및 발송
 * - 인증 코드 검증
 * - 요청 제한 (Rate Limiting)
 * - 만료된 코드 정리
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service';
import { EmailService } from './email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createMockPrismaService, expectToThrowAsync } from '../test/test-helpers';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const mockEmailService = {
      sendVerificationCode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<EmailVerificationService>(EmailVerificationService);
    emailService = module.get(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('인증 코드 생성 및 발송 (sendVerificationCode)', () => {
    const email = 'test@example.com';

    beforeEach(() => {
      // 기본 Mock 설정
      prisma.emailVerification.deleteMany.mockResolvedValue({ count: 0 } as any);
      prisma.emailVerification.findFirst.mockResolvedValue(null);
      prisma.emailVerification.create.mockResolvedValue({
        id: 'verification-id',
        email,
        code: '123456',
        expiresAt: new Date(),
        createdAt: new Date(),
      } as any);
      emailService.sendVerificationCode.mockResolvedValue(undefined);
    });

    it('정상적으로 인증 코드를 생성하고 이메일을 발송해야 한다', async () => {
      // Given: 이전 인증 기록 없음
      prisma.emailVerification.findFirst.mockResolvedValue(null);

      // When: 인증 코드 발송 요청
      await service.sendVerificationCode(email);

      // Then: 코드 생성 및 이메일 발송
      expect(prisma.emailVerification.deleteMany).toHaveBeenCalledWith({
        where: {
          email,
          expiresAt: { lt: expect.any(Date) },
        },
      });
      expect(prisma.emailVerification.create).toHaveBeenCalledWith({
        data: {
          email,
          code: expect.stringMatching(/^\d{6}$/),
          expiresAt: expect.any(Date),
        },
      });
      expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
        email,
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('생성된 코드는 6자리 숫자여야 한다', async () => {
      // When: 인증 코드 발송
      await service.sendVerificationCode(email);

      // Then: 6자리 숫자 코드 생성
      const createCall = prisma.emailVerification.create.mock.calls[0][0];
      const code = createCall.data.code;
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    });

    it('1분 이내에 재요청하면 BadRequestException을 던진다', async () => {
      // Given: 30초 전에 생성된 인증 코드
      const recentCode = {
        id: 'recent-id',
        email,
        code: '123456',
        createdAt: new Date(Date.now() - 30 * 1000), // 30초 전
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10분 후 만료
      };
      prisma.emailVerification.findFirst.mockResolvedValue(recentCode as any);

      // When & Then: BadRequestException 발생
      await expectToThrowAsync(
        () => service.sendVerificationCode(email),
        BadRequestException,
        '인증 코드는 1분에 한 번만 요청할 수 있습니다',
      );

      expect(prisma.emailVerification.create).not.toHaveBeenCalled();
      expect(emailService.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('1분 이상 지난 후 재요청은 허용된다', async () => {
      // Given: 90초 전에 생성된 인증 코드
      const oldCode = {
        id: 'old-id',
        email,
        code: '123456',
        createdAt: new Date(Date.now() - 90 * 1000), // 90초 전
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };
      prisma.emailVerification.findFirst.mockResolvedValue(oldCode as any);

      // When: 인증 코드 재발송
      await service.sendVerificationCode(email);

      // Then: 새 코드 생성 및 발송
      expect(prisma.emailVerification.create).toHaveBeenCalled();
      expect(emailService.sendVerificationCode).toHaveBeenCalled();
    });

    it('만료된 코드는 자동으로 삭제된다', async () => {
      // Given: 만료된 코드 존재 (findFirst에서 조회 안 됨)
      prisma.emailVerification.findFirst.mockResolvedValue(null);

      // When: 새 코드 요청
      await service.sendVerificationCode(email);

      // Then: 만료된 코드 삭제 호출
      expect(prisma.emailVerification.deleteMany).toHaveBeenCalledWith({
        where: {
          email,
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });

    it('코드의 만료 시간은 10분이어야 한다', async () => {
      // When: 인증 코드 발송
      const beforeTime = Date.now();
      await service.sendVerificationCode(email);
      const afterTime = Date.now();

      // Then: 만료 시간이 현재 시간 + 10분
      const createCall = prisma.emailVerification.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const expectedExpiry = 10 * 60 * 1000; // 10분

      // 약간의 오차 허용 (테스트 실행 시간)
      const actualExpiry = expiresAt.getTime() - beforeTime;
      expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(actualExpiry).toBeLessThanOrEqual(expectedExpiry + 1000);
    });
  });

  describe('인증 코드 검증 (verifyCode)', () => {
    const email = 'test@example.com';
    const validCode = '123456';

    it('유효한 코드로 인증을 성공해야 한다', async () => {
      // Given: 유효한 인증 코드
      const verification = {
        id: 'verification-id',
        email,
        code: validCode,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };
      prisma.emailVerification.findFirst.mockResolvedValue(verification as any);
      prisma.emailVerification.delete.mockResolvedValue(verification as any);

      // When: 코드 검증
      const result = await service.verifyCode(email, validCode);

      // Then: 인증 성공 및 코드 삭제
      expect(result).toBe(true);
      expect(prisma.emailVerification.findFirst).toHaveBeenCalledWith({
        where: {
          email,
          code: validCode,
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.emailVerification.delete).toHaveBeenCalledWith({
        where: { id: verification.id },
      });
    });

    it('잘못된 코드는 NotFoundException을 던진다', async () => {
      // Given: 일치하는 코드 없음
      prisma.emailVerification.findFirst.mockResolvedValue(null);

      // When & Then: NotFoundException 발생
      await expectToThrowAsync(
        () => service.verifyCode(email, 'wrong-code'),
        NotFoundException,
        '유효하지 않거나 만료된 인증 코드입니다',
      );

      expect(prisma.emailVerification.delete).not.toHaveBeenCalled();
    });

    it('만료된 코드는 NotFoundException을 던진다', async () => {
      // Given: 만료된 코드 (findFirst에서 걸러짐)
      prisma.emailVerification.findFirst.mockResolvedValue(null);

      // When & Then: NotFoundException 발생
      await expectToThrowAsync(
        () => service.verifyCode(email, validCode),
        NotFoundException,
        '유효하지 않거나 만료된 인증 코드입니다',
      );
    });

    it('검증 성공 후 코드는 삭제되어야 한다 (재사용 방지)', async () => {
      // Given: 유효한 코드
      const verification = {
        id: 'verification-id',
        email,
        code: validCode,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };
      prisma.emailVerification.findFirst.mockResolvedValue(verification as any);
      prisma.emailVerification.delete.mockResolvedValue(verification as any);

      // When: 코드 검증
      await service.verifyCode(email, validCode);

      // Then: 코드 삭제됨
      expect(prisma.emailVerification.delete).toHaveBeenCalledWith({
        where: { id: verification.id },
      });
    });
  });

  describe('만료된 코드 정리 (cleanupExpiredCodes)', () => {
    it('만료된 코드를 삭제해야 한다', async () => {
      // Given: 만료된 코드 존재
      prisma.emailVerification.deleteMany.mockResolvedValue({ count: 5 } as any);

      // When: 정리 작업 실행
      await service.cleanupExpiredCodes();

      // Then: 만료된 코드 삭제
      expect(prisma.emailVerification.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });

    it('만료된 코드가 없으면 아무 것도 삭제하지 않는다', async () => {
      // Given: 만료된 코드 없음
      prisma.emailVerification.deleteMany.mockResolvedValue({ count: 0 } as any);

      // When: 정리 작업 실행
      await service.cleanupExpiredCodes();

      // Then: 삭제 호출은 되었지만 삭제된 것 없음
      expect(prisma.emailVerification.deleteMany).toHaveBeenCalled();
    });

    it('대량의 만료된 코드도 처리할 수 있어야 한다', async () => {
      // Given: 많은 만료된 코드
      prisma.emailVerification.deleteMany.mockResolvedValue({ count: 1000 } as any);

      // When: 정리 작업 실행
      await service.cleanupExpiredCodes();

      // Then: 모두 삭제됨
      expect(prisma.emailVerification.deleteMany).toHaveBeenCalled();
    });
  });
});
