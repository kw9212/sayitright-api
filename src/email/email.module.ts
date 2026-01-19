import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailVerificationService } from './email-verification.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [EmailService, EmailVerificationService],
  exports: [EmailService, EmailVerificationService],
})
export class EmailModule {}
