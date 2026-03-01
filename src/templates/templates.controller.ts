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
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
  ApiParam,
  getSchemaPath,
  ApiExtraModels,
} from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { GetTemplatesQueryDto } from './dto/get-templates-query.dto';
import { TemplateResponseDto, TemplateListResponseDto } from './dto/template-response.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthRequest } from '../common/types/auth-request.type';

@ApiTags('Templates')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: '인증 필요 (유효한 Access Token 없음)' })
@ApiExtraModels(TemplateResponseDto, TemplateListResponseDto)
@Controller('v1/templates')
@UseGuards(JwtAccessGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @ApiOperation({
    summary: '이메일 템플릿 목록 조회',
    description: '저장된 이메일 템플릿을 페이지네이션, 검색, 필터링하여 조회합니다.',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        data: { $ref: getSchemaPath(TemplateListResponseDto) },
      },
    },
  })
  @Get()
  async findAll(
    @Req() req: AuthRequest,
    @Query() query: GetTemplatesQueryDto,
  ): Promise<TemplateListResponseDto> {
    const userId = req.user.sub;

    return this.templatesService.findAll(userId, query);
  }

  @ApiOperation({ summary: '이메일 템플릿 단건 조회' })
  @ApiParam({ name: 'id', description: '템플릿 ID' })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        data: { $ref: getSchemaPath(TemplateResponseDto) },
      },
    },
  })
  @ApiNotFoundResponse({ description: '템플릿을 찾을 수 없음' })
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthRequest): Promise<TemplateResponseDto> {
    const userId = req.user.sub;

    return this.templatesService.findOne(id, userId);
  }

  @ApiOperation({ summary: '이메일 템플릿 저장', description: '이메일을 템플릿으로 저장합니다.' })
  @ApiCreatedResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        data: { type: 'object', properties: { id: { type: 'string', example: 'clx1abc123' } } },
      },
    },
  })
  @Post()
  async create(@Body() dto: CreateTemplateDto, @Req() req: AuthRequest): Promise<{ id: string }> {
    const userId = req.user.sub;
    return this.templatesService.create(userId, dto);
  }

  @ApiOperation({ summary: '이메일 템플릿 수정' })
  @ApiParam({ name: 'id', description: '템플릿 ID' })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: { type: 'boolean', example: true },
        data: { $ref: getSchemaPath(TemplateResponseDto) },
      },
    },
  })
  @ApiNotFoundResponse({ description: '템플릿을 찾을 수 없음' })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @Req() req: AuthRequest,
  ): Promise<TemplateResponseDto> {
    const userId = req.user.sub;
    return this.templatesService.update(id, userId, dto);
  }

  @ApiOperation({ summary: '이메일 템플릿 삭제' })
  @ApiParam({ name: 'id', description: '템플릿 ID' })
  @ApiOkResponse({
    schema: { properties: { ok: { type: 'boolean', example: true } } },
  })
  @ApiNotFoundResponse({ description: '템플릿을 찾을 수 없음' })
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest): Promise<void> {
    const userId = req.user.sub;

    await this.templatesService.remove(id, userId);
  }
}
