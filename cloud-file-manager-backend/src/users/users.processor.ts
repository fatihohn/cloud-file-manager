import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

@Processor('user-events')
export class UserEventProcessor {
  private readonly logger = new Logger(UserEventProcessor.name);

  @Process('user-deletion')
  handleUserDeletion(job: Job) {
    const { userId } = job.data as { userId: string };
    if (!userId) {
      this.logger.warn(
        `[user-deletion-job] job ID: ${job.id} has no userId in data.`,
      );
      return;
    }

    this.logger.log(
      `[user-deletion-job] [job ID: ${job.id}] user ID: ${userId} handling started...`,
    );
    this.logger.log(
      `[user-deletion-job] [job ID: ${job.id}] user ID: ${userId} handling completed.`,
    );

    return Promise.resolve();
  }
}
