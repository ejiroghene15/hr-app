import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from 'prisma/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  await app.listen(env('PORT') ?? 3000);
}

bootstrap();
