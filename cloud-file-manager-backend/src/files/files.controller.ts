import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { PresignedUrlResponseDto } from './dto/presigned-url-response.dto';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';
import { User, UserRole } from '../users/entity/user.entity';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/decorator/roles.decorator';
import { RolesGuard } from '../auth/guard/roles.guard';
import { FILE_ERRORS, FILE_RESPONSES } from './files.errors';
import { CreatePresignedUrlDto } from './dto/create-presigned-url.dto';
import { CreatePresignedUploadUrlResponseDto } from './dto/create-presigned-upload-url-response.dto';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presigned-url')
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @ApiOperation({ summary: 'Generate presigned URLs for direct S3 upload' })
  @ApiBody({ type: [CreatePresignedUrlDto] })
  @ApiOkResponse({ type: [CreatePresignedUploadUrlResponseDto] })
  async getPresignedUrls(
    @Req() req: { user: User },
    @Body() createDtos: CreatePresignedUrlDto[],
  ) {
    if (!Array.isArray(createDtos) || createDtos.length === 0) {
      throw new BadRequestException('Request body must be a non-empty array.');
    }
    const data = await this.filesService.createPresignedUploadUrls(
      req.user,
      createDtos,
    );
    return { data };
  }

  @Get()
  @ApiOperation({ summary: 'List my files' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search by original name',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'ISO date filter (inclusive)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'ISO date filter (inclusive)',
    example: '2025-12-31T23:59:59.999Z',
  })
  @ApiOkResponse({
    schema: {
      example: {
        data: [
          {
            id: 'file-id',
            originalName: 'health_data_small.csv',
            mimeType: 'text/csv',
            sizeBytes: '10240',
            status: 'ACTIVE',
            createdAt: '2025-01-01T12:00:00Z',
            ownerId: 'user-id',
          },
        ],
        meta: { page: 1, limit: 20, total: 1 },
      },
    },
  })
  async listMyFiles(
    @Req() req: { user: User },
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const query: ListFilesQueryDto = {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      q: q ?? undefined,
      from: from ?? undefined,
      to: to ?? undefined,
    };
    return this.filesService.listUserFiles(req.user, query);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all files (Admin only)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiOkResponse({
    description: 'All non-deleted files (paginated).',
  })
  @ApiForbiddenResponse({
    description: 'Non-admin attempted to list all files.',
    schema: { example: FILE_ERRORS.FORBIDDEN_RESOURCE },
  })
  async listAllFiles(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const query: ListFilesQueryDto = {
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      q: q ?? undefined,
      from: from ?? undefined,
      to: to ?? undefined,
    };
    return this.filesService.listAllFiles(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get file metadata by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FileUploadResponseDto })
  @ApiNotFoundResponse({ description: 'File not found' })
  async getFileById(
    @Req() req: { user: User },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.getFileById(id, req.user);
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a presigned download URL' })
  @ApiOkResponse({ type: PresignedUrlResponseDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNotFoundResponse({
    description: 'File not found or soft deleted.',
    schema: { example: FILE_ERRORS.FILE_NOT_FOUND },
  })
  @ApiForbiddenResponse({
    description: 'User does not own the file.',
    schema: { example: FILE_ERRORS.FORBIDDEN_RESOURCE },
  })
  async downloadFile(
    @Req() req: { user: User },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.generateDownloadUrl(id, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a file (DB only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    description: 'File marked as soft-deleted in DB.',
    schema: { example: FILE_RESPONSES.FILE_SOFT_DELETED },
  })
  @ApiNotFoundResponse({
    description: 'File does not exist.',
    schema: { example: FILE_ERRORS.FILE_NOT_FOUND },
  })
  @ApiForbiddenResponse({
    description: 'User does not own the file.',
    schema: { example: FILE_ERRORS.FORBIDDEN_RESOURCE },
  })
  async softDelete(
    @Req() req: { user: User },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.softDelete(id, req.user);
  }
}
