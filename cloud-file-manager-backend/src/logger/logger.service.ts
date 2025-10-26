import {
  Inject,
  Injectable,
  LoggerService as NestLoggerService,
  LogLevel,
} from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: NestLoggerService,
  ) {}

  log(message: string, ...optionalParams: unknown[]) {
    this.logger.log(message, ...optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]) {
    this.logger.error(message, ...optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]) {
    this.logger.warn(message, ...optionalParams);
  }

  debug?(message: string, ...optionalParams: unknown[]) {
    this.logger.debug?.(message, ...optionalParams);
  }

  verbose?(message: string, ...optionalParams: unknown[]) {
    this.logger.verbose?.(message, ...optionalParams);
  }

  setLogLevels?(levels: LogLevel[]) {
    const target = this.logger as NestLoggerService & {
      setLogLevels?: (levels: LogLevel[]) => void;
    };
    target.setLogLevels?.(levels);
  }
}
