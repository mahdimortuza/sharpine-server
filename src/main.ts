/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    app.use(cookieParser());

    const allowedOrigins = [
      'http://localhost:3000',
      'https://sharpine-client.vercel.app',
    ];

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      exposedHeaders: ['Set-Cookie'],
    });

    // CRITICAL: Get port from environment variable
    const port = parseInt(process.env.PORT || '5000', 10);

    // CRITICAL: Bind to 0.0.0.0 for Fly.io
    await app.listen(port, '0.0.0.0');

    console.log(`✅ Server started successfully`);
    console.log(`🚀 Listening on 0.0.0.0:${port}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
