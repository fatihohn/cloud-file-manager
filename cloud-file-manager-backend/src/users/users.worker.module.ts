import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { UserEventProcessor } from './users.processor';
import { User } from './entity/user.entity';
import { FileUpload } from '../files/entities/file-upload.entity';
import { USER_EVENTS_QUEUE } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, FileUpload]),
    BullModule.registerQueue({ name: USER_EVENTS_QUEUE }),
  ],
  providers: [UserEventProcessor],
})
export class UsersWorkerModule {}
