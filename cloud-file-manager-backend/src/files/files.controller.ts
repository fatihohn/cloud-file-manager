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
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
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
import { FILE_ERRORS } from './files.errors';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my files' })
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
    @Query() query: ListFilesQueryDto,
  ) {
    return this.filesService.listUserFiles(req.user, query);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all files (Admin only)' })
  async listAllFiles(@Query() query: ListFilesQueryDto) {
    return this.filesService.listAllFiles(query);
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a presigned download URL' })
  @ApiOkResponse({ type: PresignedUrlResponseDto })
  async downloadFile(
    @Req() req: { user: User },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.generateDownloadUrl(id, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a file (DB only)' })
  async softDelete(
    @Req() req: { user: User },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.softDelete(id, req.user);
  }
}
