/**
 * E2E 테스트 공통 설정
 *
 * - 실제 DB/Redis 연결
 * - 테스트 데이터 정리
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AppModule } from '../../src/app.module';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return app;
}

export async function cleanupDatabase(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);

  // 순서 중요: 외래키 관계 고려
  await prisma.creditTransaction.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.usageTracking.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.archive.deleteMany();
  await prisma.template.deleteMany();
  await prisma.expressionNote.deleteMany();
  await prisma.user.deleteMany();
}
