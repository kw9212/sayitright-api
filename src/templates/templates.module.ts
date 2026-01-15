import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { JwtConfigModule } from '../auth/jwt-config.module';

@Module({
  imports: [PrismaModule, JwtConfigModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
