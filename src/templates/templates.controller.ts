import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { GetTemplatesQueryDto } from './dto/get-templates-query.dto';
import { TemplateResponseDto, TemplateListResponseDto } from './dto/template-response.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthRequest } from '../common/types/auth-request.type';

@Controller('v1/templates')
@UseGuards(JwtAccessGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async findAll(
    @Req() req: AuthRequest,
    @Query() query: GetTemplatesQueryDto,
  ): Promise<TemplateListResponseDto> {
    const userId = req.user.sub;

    return this.templatesService.findAll(userId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthRequest): Promise<TemplateResponseDto> {
    const userId = req.user.sub;

    return this.templatesService.findOne(id, userId);
  }

  @Post()
  async create(@Body() dto: CreateTemplateDto, @Req() req: AuthRequest): Promise<{ id: string }> {
    const userId = req.user.sub;
    return this.templatesService.create(userId, dto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @Req() req: AuthRequest,
  ): Promise<TemplateResponseDto> {
    const userId = req.user.sub;
    return this.templatesService.update(id, userId, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest): Promise<void> {
    const userId = req.user.sub;

    await this.templatesService.remove(id, userId);
  }
}
