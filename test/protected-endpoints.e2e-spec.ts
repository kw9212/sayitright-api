/**
 * Protected Endpoints E2E 테스트
 *
 * 인증이 필요한 API 엔드포인트의 인증 검증 테스트
 * - Notes, Templates, Archives, Users, AI endpoints
 * - JWT 인증 확인
 * - 401 Unauthorized 응답 검증
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { SuccessResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Protected Endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        user: { findUnique: jest.fn() },
        expressionNote: { findMany: jest.fn(), count: jest.fn() },
        template: { findMany: jest.fn(), count: jest.fn() },
        archive: { findMany: jest.fn(), count: jest.fn() },
        subscription: { findFirst: jest.fn() },
        usageTracking: { findUnique: jest.fn() },
      })
      .overrideProvider('REDIS_CLIENT')
      .useValue({
        get: jest.fn(),
        set: jest.fn(),
        quit: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new SuccessResponseInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Notes Endpoints - Authentication Check', () => {
    it('GET /v1/notes - 인증 없이 요청 시 401 에러', () => {
      return request(app.getHttpServer())
        .get('/v1/notes')
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('ok', false);
          expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
        });
    });

    it('GET /v1/notes - 유효하지 않은 토큰으로 401 에러', () => {
      return request(app.getHttpServer())
        .get('/v1/notes')
        .set('Authorization', 'Bearer invalid-token-12345')
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('ok', false);
        });
    });

    it('POST /v1/notes - 인증 없이 요청 시 401 에러', () => {
      return request(app.getHttpServer())
        .post('/v1/notes')
        .send({ content: 'test note' })
        .expect(401);
    });

    it('PUT /v1/notes/:id - 인증 없이 요청 시 401 에러', () => {
      return request(app.getHttpServer())
        .put('/v1/notes/test-id')
        .send({ content: 'updated' })
        .expect(401);
    });

    it('DELETE /v1/notes/:id - 인증 없이 요청 시 401 에러', () => {
      return request(app.getHttpServer()).delete('/v1/notes/test-id').expect(401);
    });
  });

  describe('Templates Endpoints - Authentication Check', () => {
    it('GET /v1/templates - 인증 없이 요청 시 401 에러', () => {
      return request(app.getHttpServer()).get('/v1/templates').expect(401);
    });

    it('POST /v1/templates - 인증 없이 요청 시 401 에러', () => {
      return request(app.getHttpServer())
        .post('/v1/templates')
        .send({ name: 'test', content: 'test' })
        .expect(401);
    });

    it('GET /v1/templates/:id - 인증 없이 요청 시 401 에러', () => {
      return request(app.getHttpServer()).get('/v1/templates/test-id').expect(401);
    });
  });

  describe('Archives Endpoints - Authentication Check', () => {
    it('GET /v1/archives - 인증 없이 요청 시 401 에러', () => {
      return request(app.getHttpServer()).get('/v1/archives').expect(401);
    });

    it('GET /v1/archives/:id - 인증 없이 요청 시 401 에러', () => {
      return request(app.getHttpServer()).get('/v1/archives/test-id').expect(401);
    });

    it('DELETE /v1/archives/:id - 인증 없이 요청 시 401 에러', () => {
      return request(app.getHttpServer()).delete('/v1/archives/test-id').expect(401);
    });
  });

  describe('Users Endpoints - Authentication Check', () => {
    it('GET /v1/users/me - 인증 없이 요청 시 401 에러', () => {
      return request(app.getHttpServer()).get('/v1/users/me').expect(401);
    });

    it('PUT /v1/users/me - 인증 없이 요청 시 401 에러', () => {
      return request(app.getHttpServer())
        .put('/v1/users/me')
        .send({ username: 'newname' })
        .expect(401);
    });
  });

  describe('AI Endpoints - Validation & Authentication', () => {
    it('POST /v1/ai/generate-email - 인증 없이 요청 시 400 에러 (validation 먼저 실행)', () => {
      return request(app.getHttpServer())
        .post('/v1/ai/generate-email')
        .send({ draft: 'test email' })
        .expect(400); // Validation이 먼저 실행되어 400 반환
    });

    it('POST /v1/ai/generate-email - 유효하지 않은 토큰으로 400 에러', () => {
      return request(app.getHttpServer())
        .post('/v1/ai/generate-email')
        .set('Authorization', 'Bearer fake-token')
        .send({ draft: 'test email' })
        .expect(400);
    });
  });

  describe('Authorization Header Format', () => {
    it('Bearer 없이 토큰만 전송하면 401 에러', () => {
      return request(app.getHttpServer())
        .get('/v1/notes')
        .set('Authorization', 'just-a-token')
        .expect(401);
    });

    it('빈 Authorization 헤더로 401 에러', () => {
      return request(app.getHttpServer()).get('/v1/notes').set('Authorization', '').expect(401);
    });

    it('Bearer 뒤에 토큰이 없으면 401 에러', () => {
      return request(app.getHttpServer())
        .get('/v1/notes')
        .set('Authorization', 'Bearer ')
        .expect(401);
    });
  });
});
