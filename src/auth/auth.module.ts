import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [
    UsersModule,
    RedisModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '5m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
