import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { FileUpload } from './entities/file-upload.entity';
import { FILES_S3_CLIENT } from './files.constants';
import { S3Client } from '@aws-sdk/client-s3';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([FileUpload])],
  providers: [
    FilesService,
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
export class FilesModule {}
