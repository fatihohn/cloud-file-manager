import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from './worker-app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const shutdown = async (signal: string) => {
    const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
    logger.log(`Received ${signal}, closing worker context`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void bootstrap();
