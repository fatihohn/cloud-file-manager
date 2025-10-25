import {
  Injectable,
  LoggerService as CommonLoggerService,
} from '@nestjs/common';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

@Injectable()
export class LoggerService implements CommonLoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'log/app.log' }),
        new DailyRotateFile({
          filename: 'log/app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
        }),
      ],
    });
  }

  log(message: string, ...meta: any[]) {
    this.logger.info(message, ...meta);
  }

  error(message: string, trace: string) {
    this.logger.error(message, { trace });
  }

  warn(message: string, ...meta: any[]) {
    this.logger.warn(message, ...meta);
  }

  debug(message: string, ...meta: any[]) {
    this.logger.debug(message, ...meta);
  }

  verbose(message: string, ...meta: any[]) {
    this.logger.verbose(message, ...meta);
  }
}
