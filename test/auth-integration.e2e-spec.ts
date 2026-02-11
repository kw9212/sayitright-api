/**
 * Auth API 통합 E2E 테스트
 *
 * 인증 관련 API 엔드포인트 통합 테스트
 * Mock을 최소화하고 실제 서비스 통합 검증
 * - POST /v1/auth/signup (validation)
 * - POST /v1/auth/login (validation)
 * - POST /v1/auth/refresh
 * - POST /v1/auth/send-verification-code
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../src/email/email.service';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../src/redis/redis.module';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../src/users/users.module';
import { EmailModule } from '../src/email/email.module';
import * as bcrypt from 'bcrypt';

describe('Auth Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: null,
    tier: 'free',
    creditBalance: 0,
    authProvider: 'local',
    authProviderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AuthModule,
        UsersModule,
        EmailModule,
        RedisModule,
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        user: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        emailVerification: {
          findFirst: jest.fn(),
          create: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        subscription: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        $transaction: jest.fn((callback) => {
          if (typeof callback === 'function') {
            return callback(prisma);
          }
          return Promise.resolve();
        }),
      })
      .overrideProvider('REDIS_CLIENT')
      .useValue({
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        keys: jest.fn(),
        quit: jest.fn(),
      })
      .overrideProvider(EmailService)
      .useValue({
        sendVerificationCode: jest.fn().mockResolvedValue(undefined),
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
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/auth/signup - Validation', () => {
    it('유효한 데이터로 회원가입 요청 시 성공해야 한다', async () => {
      const signupDto = {
        email: 'newuser@example.com',
        password: 'Password123!',
        username: 'newuser',
      };

      const hashedPassword = await bcrypt.hash(signupDto.password, 10);
      const createdUser = {
        ...mockUser,
        email: signupDto.email,
        username: signupDto.username,
        passwordHash: hashedPassword,
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'create').mockResolvedValue(createdUser);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .send(signupDto)
        .expect(201);

      // Signup은 자동 로그인되어 accessToken 반환
      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');
    });

    it('필수 필드가 없으면 400 에러를 반환해야 한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('message');
    });

    it('유효하지 않은 이메일 형식으로 400 에러를 반환해야 한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'Password123!',
          username: 'testuser',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('약한 비밀번호로 400 에러를 반환해야 한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'weak',
          username: 'testuser',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('중복된 이메일로 409 에러를 반환해야 한다', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .send({
          email: 'existing@example.com',
          password: 'Password123!',
          username: 'existinguser',
        })
        .expect(409);

      expect(response.body).toHaveProperty('statusCode', 409);
    });
  });

  describe('POST /v1/auth/login - Validation & Flow', () => {
    it('유효한 자격증명으로 로그인 성공해야 한다', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const hashedPassword = await bcrypt.hash(loginDto.password, 10);
      const user = {
        ...mockUser,
        passwordHash: hashedPassword,
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(user);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send(loginDto)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('필수 필드가 없으면 400 에러를 반환해야 한다', async () => {
      await request(app.getHttpServer()).post('/v1/auth/login').send({}).expect(400);
    });

    it('존재하지 않는 이메일로 401 에러를 반환해야 한다', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });

    it('잘못된 비밀번호로 401 에러를 반환해야 한다', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
      const user = {
        ...mockUser,
        passwordHash: hashedPassword,
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(user);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });
  });

  describe('POST /v1/auth/refresh', () => {
    it('refresh token이 없으면 401 에러를 반환해야 한다', async () => {
      const response = await request(app.getHttpServer()).post('/v1/auth/refresh').expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });
  });

  describe('POST /v1/auth/send-verification-code', () => {
    it('유효한 이메일로 인증 코드 전송 성공해야 한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('유효하지 않은 이메일로 400 에러를 반환해야 한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ email: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('이메일 필드가 없으면 400 에러를 반환해야 한다', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({})
        .expect(400);
    });
  });

  describe('POST /v1/auth/logout', () => {
    it('로그아웃 요청이 성공해야 한다', async () => {
      await request(app.getHttpServer()).post('/v1/auth/logout').expect(200);
    });
  });
});
