import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { USER_EVENTS_QUEUE } from '../queue/queue.constants';
import { LoggerService } from '../logger/logger.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FileUpload,
  FileUploadStatus,
} from '../files/entities/file-upload.entity';

interface UserDeletionJobData {
  userId: string;
}

@Injectable()
@Processor(USER_EVENTS_QUEUE, {
  concurrency: 2,
  limiter: { max: 5, duration: 1000 },
})
export class UserEventProcessor extends WorkerHost {
  constructor(
    private readonly logger: LoggerService,
    @InjectRepository(FileUpload)
    private readonly fileUploadRepository: Repository<FileUpload>,
  ) {
    super();
  }

  async process(job: Job<UserDeletionJobData>): Promise<void> {
    const { userId } = job.data ?? {};

    if (!userId) {
      this.logger.warn('[user-deletion-job] job missing userId', {
        jobId: job.id,
        queue: job.queueName,
      });
      return;
    }

    this.logger.log('[user-deletion-job] handling started', {
      jobId: job.id,
      userId,
    });

    await this.handleUserSoftDeleted(String(userId));

    // Placeholder for actual deletion side-effects.
    this.logger.log('[user-deletion-job] handling completed', {
      jobId: job.id,
      userId,
    });

    await job.updateProgress(100);
  }

  private async handleUserSoftDeleted(userId: string): Promise<void> {
    await this.fileUploadRepository.update(
      { ownerId: userId },
      { status: FileUploadStatus.SOFT_DELETED, softDeletedAt: new Date() },
    );
  }
}
