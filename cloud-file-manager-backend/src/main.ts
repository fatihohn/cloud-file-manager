import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { LoggerService } from './logger/logger.service';
import compression from 'compression';
import bodyParser from 'body-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new LoggerService(),
  });

  app.use(compression());
  app.use(bodyParser.json({ limit: '100mb' }));
  app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Cloud File Manager API')
    .setDescription('API documentation of Cloud File Manager')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Graceful shutdown for SIGINT or SIGTERM
  process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing application...');
    await app.close().then(() => process.exit(0));
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing application...');
    await app.close().then(() => process.exit(0));
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
