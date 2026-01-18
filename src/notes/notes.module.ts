import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { PrismaModule } from 'prisma/prisma.module';
import { JwtConfigModule } from 'src/auth/jwt-config.module';

@Module({
  imports: [PrismaModule, JwtConfigModule],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
