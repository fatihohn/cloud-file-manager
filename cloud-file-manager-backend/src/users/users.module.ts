import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { LoggerService } from '../logger/logger.service';
import { BullModule } from '@nestjs/bull';
import { UserEventProcessor } from './users.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    BullModule.registerQueue({
      name: 'user-events',
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, UserEventProcessor, LoggerService],
  exports: [UsersService],
})
export class UsersModule {}
