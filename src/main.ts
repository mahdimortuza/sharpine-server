import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(cookieParser());

  app.enableCors({
    // origin: 'http://localhost:3000',
    origin: 'https://sharpine-client.vercel.app/',
    credentials: true,
  });

  await app.listen(3000);
  console.log(`🚀 Server running on port ${3000}`);
}
bootstrap();
