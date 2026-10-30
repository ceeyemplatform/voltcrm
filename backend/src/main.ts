import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Written quotation pages carry formatted text, which can exceed the 100kb default
  app.useBodyParser('json', { limit: '2mb' });
  // Behind Railway's proxy: use the visitor's IP (not the proxy's) for rate limiting
  app.set('trust proxy', 1);

  // CORS: only the app's own frontend may call the API from a browser.
  // FRONTEND_URL can list several origins, comma-separated (e.g. the deployed site).
  const allowedOrigins = new Set(
    [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      ...(process.env.FRONTEND_URL || '').split(','),
    ]
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean),
  );
  const isProduction = process.env.NODE_ENV === 'production';
  // In development the Vite server is also opened from other devices on the local network (host: true)
  const isLocalDevOrigin = (origin: string) =>
    !isProduction &&
    /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);

  app.enableCors({
    origin: (origin, callback) => {
      // Requests without an Origin header (curl, server-to-server) carry no browser credentials
      if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Standard security headers. The API is called from the frontend's origin, so resources may be
  // shared cross-origin (CORS above still decides which sites can read them).
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Global API Prefix
  app.setGlobalPrefix('api');

  // Global Validation Pipe with auto transformation and whitelisting
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      forbidNonWhitelisted: false,
    }),
  );

  // Global Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`⚡ Electrical CRM Backend running on http://localhost:${port}/api`);
}

bootstrap();
