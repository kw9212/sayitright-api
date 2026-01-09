import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaModule } from 'prisma/prisma.module';
import { UsersController } from './users.controller';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access.guard';
import { JwtConfigModule } from 'src/auth/jwt-config.module';

@Module({
  imports: [PrismaModule, JwtConfigModule],
  controllers: [UsersController],
  providers: [UsersService, JwtAccessGuard],
  exports: [UsersService],
})
export class UsersModule {}
