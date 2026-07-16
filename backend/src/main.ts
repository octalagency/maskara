import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateProductionEnv } from './config/validate-env';

async function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    });
    console.log('✓ Sentry monitoring enabled');
  } catch {
    console.warn('Sentry DSN set but @sentry/node not installed');
  }
}

async function bootstrap() {
  await initSentry();
  validateProductionEnv();
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(
    helmet({
      // ePBX must fetch hosted TTS MP3 from api.maskara.bd
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.APP_URL,
    'https://app.maskara.bd',
    'https://maskara.bd',
    'https://www.maskara.bd',
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
  ].filter(Boolean) as string[];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Maskara API')
    .setDescription('AI Order Verification Platform for eCommerce')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Maskara API running on port ${port}`);
}

bootstrap();
