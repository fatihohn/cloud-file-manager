import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import {
  S3_UPLOAD_NOTIFICATIONS_QUEUE,
  USER_EVENTS_QUEUE,
} from './queue.constants';
import { RedisOptions } from 'ioredis';

@Global()
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST', 'redis');
        const port = parseInt(
          configService.get<string>('REDIS_PORT', '6379'),
          10,
        );
        const username = configService.get<string>('REDIS_USERNAME');
        const password = configService.get<string>('REDIS_PASSWORD');
        const tlsEnabled =
          String(
            configService.get<string>('REDIS_TLS', 'false'),
          ).toLowerCase() === 'true';

        const connection: RedisOptions = {
          host,
          port,
        };

        if (username) {
          connection.username = username;
        }

        if (password) {
          connection.password = password;
        }

        if (tlsEnabled) {
          connection.tls = {};
        }

        return {
          connection,
          defaultJobOptions: {
            attempts: parseInt(
              configService.get<string>('BULLMQ_ATTEMPTS', '3'),
              10,
            ),
            backoff: {
              type: 'exponential' as const,
              delay: parseInt(
                configService.get<string>('BULLMQ_BACKOFF_DELAY', '1000'),
                10,
              ),
            },
            removeOnComplete: parseInt(
              configService.get<string>('BULLMQ_REMOVE_ON_COMPLETE', '50'),
              10,
            ),
            removeOnFail: parseInt(
              configService.get<string>('BULLMQ_REMOVE_ON_FAIL', '100'),
              10,
            ),
          },
        };
      },
    }),
    BullModule.registerQueue(
      {
        name: USER_EVENTS_QUEUE,
      },
      {
        name: S3_UPLOAD_NOTIFICATIONS_QUEUE,
      },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
