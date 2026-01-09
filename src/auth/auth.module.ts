import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { RedisModule } from 'src/redis/redis.module';
import { JwtConfigModule } from './jwt-config.module';

@Module({
  imports: [UsersModule, RedisModule, JwtConfigModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
