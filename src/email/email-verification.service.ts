import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { EmailService } from './email.service';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly CODE_LENGTH = 6;
  private readonly CODE_EXPIRY_MINUTES = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private generateCode(): string {
    const min = Math.pow(10, this.CODE_LENGTH - 1);
    const max = Math.pow(10, this.CODE_LENGTH) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  async sendVerificationCode(email: string): Promise<void> {
    await this.prisma.emailVerification.deleteMany({
      where: {
        email,
        expiresAt: { lt: new Date() },
      },
    });

    const recentCode = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentCode) {
      const timeSinceCreation = Date.now() - recentCode.createdAt.getTime();
      const oneMinute = 60 * 1000;

      if (timeSinceCreation < oneMinute) {
        throw new BadRequestException('인증 코드는 1분에 한 번만 요청할 수 있습니다.');
      }
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.CODE_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.emailVerification.create({
      data: {
        email,
        code,
        expiresAt,
      },
    });

    await this.emailService.sendVerificationCode(email, code);

    this.logger.log(`인증 코드 생성 및 발송: ${email}`);
  }

  async verifyCode(email: string, code: string): Promise<boolean> {
    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        code,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new NotFoundException('유효하지 않거나 만료된 인증 코드입니다.');
    }

    await this.prisma.emailVerification.delete({
      where: { id: verification.id },
    });

    this.logger.log(`이메일 인증 성공: ${email}`);
    return true;
  }

  async cleanupExpiredCodes(): Promise<void> {
    const result = await this.prisma.emailVerification.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      this.logger.log(`만료된 인증 코드 ${result.count}개 삭제`);
    }
  }
}
