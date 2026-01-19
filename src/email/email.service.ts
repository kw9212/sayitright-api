import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to: email,
        subject: '[SayItRight] 이메일 인증 코드',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">이메일 인증</h2>
            <p>안녕하세요,</p>
            <p>SayItRight 회원가입을 위한 인증 코드입니다:</p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #4F46E5; letter-spacing: 5px; margin: 0;">
                ${code}
              </h1>
            </div>
            <p>이 코드는 <strong>10분간</strong> 유효합니다.</p>
            <p>본인이 요청하지 않은 경우, 이 이메일을 무시하셔도 됩니다.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              이 이메일은 자동 발송되었습니다. 회신하지 마세요.
            </p>
          </div>
        `,
      });

      this.logger.log(`인증 코드 이메일 발송 완료: ${email}`);
    } catch (error) {
      this.logger.error(`이메일 발송 실패: ${email}`, error);
      throw new Error('이메일 발송에 실패했습니다.');
    }
  }
}
