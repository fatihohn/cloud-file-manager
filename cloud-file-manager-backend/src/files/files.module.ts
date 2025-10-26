import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { FileUpload } from './entities/file-upload.entity';
import { FILES_S3_CLIENT } from './files.constants';
import { S3Client } from '@aws-sdk/client-s3';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { UsersModule } from '../users/users.module';
import { FilesUploadAuthMiddleware } from './middleware/files-upload-auth.middleware';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([FileUpload]),
    UsersModule,
    AuthModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uploadDir = configService.get<string>(
          'MULTER_TMP_DIR',
          '/tmp/cfm-upload',
        );
        if (!existsSync(uploadDir)) {
          mkdirSync(uploadDir, { recursive: true });
        }
        const fileSize = Number(
          configService.get<string>('MAX_UPLOAD_BYTES', '52428800'),
        );
        return {
          storage: diskStorage({
            destination: uploadDir,
            filename: (_req, file, cb) =>
              cb(null, `${Date.now()}-${file.originalname}`),
          }),
          limits: {
            fileSize,
          },
        };
      },
    }),
  ],
  providers: [
    FilesService,
    FilesUploadAuthMiddleware,
    {
      provide: FILES_S3_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const region = configService.get<string>('AWS_REGION');
        const credentials =
          configService.get<string>('AWS_ACCESS_KEY_ID') &&
          configService.get<string>('AWS_SECRET_ACCESS_KEY')
            ? {
                accessKeyId: configService.get<string>('AWS_ACCESS_KEY_ID')!,
                secretAccessKey: configService.get<string>(
                  'AWS_SECRET_ACCESS_KEY',
                )!,
              }
            : undefined;
        return new S3Client({
          region,
          credentials,
        });
      },
    },
  ],
  controllers: [FilesController],
})
export class FilesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(FilesUploadAuthMiddleware)
      .forRoutes({ path: 'files', method: RequestMethod.POST });
  }
}
