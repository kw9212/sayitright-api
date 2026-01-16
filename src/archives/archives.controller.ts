import { Controller, Get, Delete, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ArchivesService } from './archives.service';
import { GetArchivesQueryDto } from './dto/get-archives-query.dto';
import { ArchiveResponseDto, ArchiveListResponseDto } from './dto/archive-response.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthRequest } from '../common/types/auth-request.type';

@Controller('v1/archives')
@UseGuards(JwtAccessGuard)
export class ArchivesController {
  constructor(private readonly archivesService: ArchivesService) {}

  @Get()
  async findAll(
    @Req() req: AuthRequest,
    @Query() query: GetArchivesQueryDto,
  ): Promise<ArchiveListResponseDto> {
    const userId = req.user.sub;

    return this.archivesService.findAll(userId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthRequest): Promise<ArchiveResponseDto> {
    const userId = req.user.sub;

    return this.archivesService.findOne(id, userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest): Promise<void> {
    const userId = req.user.sub;

    await this.archivesService.remove(id, userId);
  }
}
