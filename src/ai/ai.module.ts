import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PrismaModule } from 'prisma/prisma.module';
import { JwtOptionalGuard } from '../auth/guards/jwt-optional.guard';
import { JwtConfigModule } from '../auth/jwt-config.module';
import { UsageTrackingService } from '../common/services/usage-tracking.service';

@Module({
  imports: [PrismaModule, JwtConfigModule],
  controllers: [AiController],
  providers: [AiService, JwtOptionalGuard, UsageTrackingService],
  exports: [AiService],
})
export class AiModule {}
