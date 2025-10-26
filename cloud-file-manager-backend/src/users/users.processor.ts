import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { USER_EVENTS_QUEUE } from '../queue/queue.constants';
import { LoggerService } from '../logger/logger.service';

interface UserDeletionJobData {
  userId: string;
}

@Injectable()
@Processor(USER_EVENTS_QUEUE, {
  concurrency: 2,
  limiter: { max: 5, duration: 1000 },
})
export class UserEventProcessor extends WorkerHost {
  constructor(private readonly logger: LoggerService) {
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

    // Placeholder for actual deletion side-effects.
    this.logger.log('[user-deletion-job] handling completed', {
      jobId: job.id,
      userId,
    });

    await job.updateProgress(100);
  }
}
