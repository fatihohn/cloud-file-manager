import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { FileUpload, FileUploadStatus } from './entities/file-upload.entity';
import { Repository } from 'typeorm';
import { LoggerService } from '../logger/logger.service';
import { S3_UPLOAD_NOTIFICATIONS_QUEUE } from '../queue/queue.constants';

interface S3EventRecord {
  s3: {
    bucket: {
      name: string;
    };
    object: {
      key: string;
      size: number;
    };
  };
}

interface S3Message {
  Records: S3EventRecord[];
}

@Processor(S3_UPLOAD_NOTIFICATIONS_QUEUE)
export class S3EventProcessor extends WorkerHost {
  constructor(
    @InjectRepository(FileUpload)
    private readonly filesRepository: Repository<FileUpload>,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async process(job: Job<S3Message>): Promise<void> {
    for (const record of job.data.Records) {
      const s3Key = decodeURIComponent(
        record.s3.object.key.replace(/\+/g, ' '),
      );

      const file = await this.filesRepository.findOne({ where: { s3Key } });

      if (file && file.status === FileUploadStatus.PENDING) {
        file.status = FileUploadStatus.ACTIVE;
        file.sizeBytes = String(record.s3.object.size);
        await this.filesRepository.save(file);
        this.logger.log(`File activated: ${s3Key}`);
      }
    }
  }
}
