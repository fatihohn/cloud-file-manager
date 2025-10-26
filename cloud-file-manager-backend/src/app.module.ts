import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LoggerModule } from './logger/logger.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { QueueModule } from './queue/queue.module';
import { FilesModule } from './files/files.module';
import { createTypeOrmOptions } from './config/typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createTypeOrmOptions,
    }),
    RedisModule.forRoot({
      config: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    UsersModule,
    AuthModule,
    LoggerModule,
    QueueModule,
    FilesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {
  constructor(private readonly configService: ConfigService) {
    if (!this.configService.get<string>('NODE_ENV')) {
      throw new Error('NODE_ENV is not defined');
    }
    if (
      !['development', 'production'].includes(
        String(this.configService.get<string>('NODE_ENV')),
      )
    ) {
      throw new Error('NODE_ENV is invalid');
    }
    if (!this.configService.get<string>('PORT')) {
      throw new Error('PORT is not defined');
    }
    if (!this.configService.get<string>('JWT_ACCESS_SECRET')) {
      throw new Error('JWT_ACCESS_SECRET is not defined');
    }
    if (!this.configService.get<string>('JWT_REFRESH_SECRET')) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }
    if (!this.configService.get<string>('JWT_ACCESS_EXPIRATION')) {
      throw new Error('JWT_ACCESS_EXPIRATION is not defined');
    }
    if (!this.configService.get<string>('JWT_REFRESH_EXPIRATION')) {
      throw new Error('JWT_REFRESH_EXPIRATION is not defined');
    }
    if (!this.configService.get<string>('POSTGRES_USER')) {
      throw new Error('POSTGRES_USER is not defined');
    }
    if (!this.configService.get<string>('POSTGRES_PASSWORD')) {
      throw new Error('POSTGRES_PASSWORD is not defined');
    }
    if (!this.configService.get<string>('POSTGRES_DATABASE')) {
      throw new Error('POSTGRES_DATABASE is not defined');
    }
  }
}
