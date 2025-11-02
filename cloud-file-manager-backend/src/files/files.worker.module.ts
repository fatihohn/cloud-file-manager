import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { User } from '../users/entity/user.entity';
import { FileUpload } from '../files/entities/file-upload.entity';
import { S3EventProcessor } from './files.processor';
import { S3_UPLOAD_NOTIFICATIONS_QUEUE } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, FileUpload]),
    BullModule.registerQueue({ name: S3_UPLOAD_NOTIFICATIONS_QUEUE }),
  ],
  providers: [S3EventProcessor],
})
export class FilesWorkerModule {}
