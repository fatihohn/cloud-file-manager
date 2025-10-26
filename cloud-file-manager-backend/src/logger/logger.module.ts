import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { LoggerService } from './logger.service';
import { inspect } from 'util';

@Global()
@Module({
  imports: [
    ConfigModule,
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const level =
          configService.get<string>('LOG_LEVEL') ??
          (nodeEnv === 'development' ? 'debug' : 'info');

        const safeStringify = (value: unknown): string => {
          if (value === undefined || value === null) {
            return '';
          }
          if (typeof value === 'string') {
            return value;
          }
          if (value instanceof Error) {
            return value.stack ?? value.message;
          }
          return inspect(value, { depth: null, breakLength: Infinity });
        };

        const consoleFormat = winston.format.printf((info) => {
          const {
            timestamp,
            level: logLevel,
            context,
            message,
            stack,
            ...meta
          } = info as winston.Logform.TransformableInfo & {
            context?: string;
            stack?: string;
          };

          const timestampLabel =
            typeof timestamp === 'string'
              ? timestamp
              : safeStringify(timestamp);
          const levelLabel =
            typeof logLevel === 'string' ? logLevel : safeStringify(logLevel);
          const contextLabel =
            typeof context === 'string' && context.length > 0
              ? ` [${context}]`
              : '';
          const serializedMessage = safeStringify(message);
          const serializedMeta =
            Object.keys(meta).length > 0 ? ` ${safeStringify(meta)}` : '';
          const stackTrace =
            typeof stack === 'string' && stack.length > 0 ? `\n${stack}` : '';

          return `${timestampLabel} [${levelLabel}]${contextLabel} ${serializedMessage}${serializedMeta}${stackTrace}`;
        });

        const jsonFormat = winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        );

        return {
          level,
          exitOnError: false,
          transports: [
            new winston.transports.Console({
              level,
              format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.colorize({ all: true }),
                winston.format.errors({ stack: true }),
                consoleFormat,
              ),
            }),
            new winston.transports.File({
              filename: 'log/app.log',
              maxsize: 10 * 1024 * 1024,
              format: jsonFormat,
            }),
            new DailyRotateFile({
              dirname: 'log',
              filename: 'app-%DATE%.log',
              datePattern: 'YYYY-MM-DD',
              zippedArchive: true,
              maxSize: '20m',
              maxFiles: '14d',
              format: jsonFormat,
            }),
          ],
        };
      },
    }),
  ],
  providers: [LoggerService],
  exports: [LoggerService, WinstonModule],
})
export class LoggerModule {}
