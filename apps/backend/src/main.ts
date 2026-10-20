import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
// cookie-parser is a CJS `export =` module and esModuleInterop is off, so a
// default import would compile to an undefined `.default` at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import cookieParser = require('cookie-parser');
import helmet from 'helmet';
import { AppModule } from './app.module';
import { buildOpenApiConfig } from './openapi';
import { parseTrustProxyHops } from './config/configuration';
import { assertProductionConfig } from './config/production-check';

async function bootstrap() {
  // Fail fast on a half-configured production boot; warnings name keys only.
  const logger = new Logger('Bootstrap');
  for (const warning of assertProductionConfig()) {
    logger.warn(warning);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind nginx/a CDN every request would otherwise appear to come from the
  // proxy's IP, collapsing the per-IP rate limit into one shared bucket.
  const trustProxyHops = parseTrustProxyHops(process.env.TRUST_PROXY_HOPS);
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  // SIGTERM (docker stop) closes the app and Prisma cleanly.
  app.enableShutdownHooks();

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? [],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3001;
  // All interfaces: inside a container the published port reaches it via the
  // container's own network interface, not loopback.
  await app.listen(port, '0.0.0.0');
}

bootstrap();
