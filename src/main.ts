import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { env } from './config/env';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Express } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: false,
    }),
  );
  app.use(compression());
  app.enableCors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
  });
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v',
    defaultVersion: '1',
  });
  app.setGlobalPrefix('api', {
    exclude: ['.well-known/(.*)'],
  });
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.enableShutdownHooks();

  if (env.SWAGGER_ENABLED) {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'),
    ) as { version: string };
    const config = new DocumentBuilder()
      .setTitle('Energy IQ API')
      .setDescription(
        'AI-powered energy management platform API for Nigerian SMEs and African businesses',
      )
      .setVersion(packageJson.version)
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        deepLinking: true,
        filter: true,
      },
    });
  }

  await app.listen(env.PORT, env.HOST);

  const logger = new Logger('Bootstrap');
  logger.log({
    message: 'Energy IQ API is running on http://localhost:' + env.PORT,
    port: env.PORT,
    host: env.HOST,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });

  if (env.SWAGGER_ENABLED)
    logger.log(`Swagger docs: http://${env.HOST}:${env.PORT}/api/docs`);
}

void bootstrap();
