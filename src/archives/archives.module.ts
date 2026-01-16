import { Module } from '@nestjs/common';
import { ArchivesService } from './archives.service';
import { ArchivesController } from './archives.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { JwtConfigModule } from '../auth/jwt-config.module';

@Module({
  imports: [PrismaModule, JwtConfigModule],
  controllers: [ArchivesController],
  providers: [ArchivesService],
  exports: [ArchivesService],
})
export class ArchivesModule {}
