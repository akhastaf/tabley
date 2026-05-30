import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { auth } from './auth/auth';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));

  const corsOrigin = process.env.API_CORS_ORIGIN ?? 'http://localhost:3010';
  const origins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
  });
  logger.log(`CORS origins: ${origins.join(', ')}`);

  app.use('/api/auth', toNodeHandler(auth));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Exclude both the shallow probe and the deep one — the deep probe lives
  // at `/health/full` and was previously caught by the `v1` prefix, which is
  // why the boot banner used to advertise a URL that 404'd.
  app.setGlobalPrefix('v1', {
    exclude: ['/health', '/health/full', '/api/auth/{*path}'],
  });

  const port = Number(process.env.API_PORT ?? 3011);
  await app.listen(port, '0.0.0.0');
  // Very loud banner so it's obvious in container logs when the API is *really*
  // ready to take requests vs. still booting / crash-looping on a dep.
  logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.log(`  Tabley API ready  →  http://localhost:${port}`);
  logger.log(`  Health probe      →  http://localhost:${port}/health/full`);
  logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

bootstrap();
