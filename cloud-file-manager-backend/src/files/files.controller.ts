import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { PresignedUrlResponseDto } from './dto/presigned-url-response.dto';
import { User, UserRole } from '../users/entity/user.entity';
import type { Express } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/decorator/roles.decorator';
import { RolesGuard } from '../auth/guard/roles.guard';
import { FILE_ERRORS, FILE_RESPONSES } from './files.errors';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @ApiOperation({ summary: 'Upload CSV files to S3' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Files successfully queued for upload/storage.',
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
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Missing files array or unsupported mime type.',
    schema: {
      example: FILE_ERRORS.UNSUPPORTED_FILE_TYPE,
    },
  })
  @ApiPayloadTooLargeResponse({
    description: 'File exceeds MAX_UPLOAD_BYTES.',
    schema: {
      example: {
        code: FILE_ERRORS.UPLOAD_TOO_LARGE.code,
        message: FILE_ERRORS.UPLOAD_TOO_LARGE.message(52428800),
      },
    },
  })
  @ApiTooManyRequestsResponse({
    description: 'Exceeded upload throttle window.',
  })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadFiles(
    @Req() req: { user: User },
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException(FILE_ERRORS.NO_FILES);
    }
    const data = await this.filesService.uploadMany(req.user, files);
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
