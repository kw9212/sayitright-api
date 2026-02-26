import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SuccessResponseInterceptor } from './common/interceptors/response.interceptor';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'fatal', 'error', 'warn', 'debug', 'verbose'],
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new SuccessResponseInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // CORS 설정: 환경변수로 허용된 origin만 접근 가능
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.use(cookieParser());

  const config = new DocumentBuilder()
    .setTitle('SayItRight API')
    .setDescription(
      `SayItRight 서비스의 REST API 문서입니다.\n\n` +
        `## 응답 형식\n` +
        `모든 성공 응답은 \`{ ok: true, data: ... }\` 형태로 래핑됩니다.\n` +
        `오류 응답은 \`{ ok: false, error: { code, message } }\` 형태입니다.\n\n` +
        `## 인증\n` +
        `- **Access Token**: \`Authorization: Bearer <token>\` 헤더로 전달\n` +
        `- **Refresh Token**: HttpOnly 쿠키(\`refreshToken\`)로 자동 관리`,
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addCookieAuth('refreshToken', { type: 'apiKey', in: 'cookie', name: 'refreshToken' })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
