import { Module } from '@nestjs/common';
import { UsersModule } from './users.module';
import { UserEventProcessor } from './users.processor';

@Module({
  imports: [UsersModule],
  providers: [UserEventProcessor],
})
export class UsersWorkerModule {}
