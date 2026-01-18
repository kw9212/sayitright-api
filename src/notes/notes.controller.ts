import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { GetNotesQueryDto } from './dto/get-notes-query.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NoteResponseDto, NoteListResponseDto } from './dto/note-response.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthRequest } from '../common/types/auth-request.type';

@Controller('v1/notes')
@UseGuards(JwtAccessGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  async findAll(
    @Req() req: AuthRequest,
    @Query() query: GetNotesQueryDto,
  ): Promise<NoteListResponseDto> {
    const userId = req.user.sub;
    return this.notesService.findAll(userId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthRequest): Promise<NoteResponseDto> {
    const userId = req.user.sub;
    return this.notesService.findOne(id, userId);
  }

  @Post()
  async create(@Body() dto: CreateNoteDto, @Req() req: AuthRequest): Promise<NoteResponseDto> {
    const userId = req.user.sub;
    return this.notesService.create(userId, dto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @Req() req: AuthRequest,
  ): Promise<NoteResponseDto> {
    const userId = req.user.sub;
    return this.notesService.update(id, userId, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest): Promise<void> {
    const userId = req.user.sub;
    await this.notesService.remove(id, userId);
  }

  @Patch(':id/star')
  async toggleStar(@Param('id') id: string, @Req() req: AuthRequest): Promise<NoteResponseDto> {
    const userId = req.user.sub;
    return this.notesService.toggleStar(id, userId);
  }
}
