import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../app.module';
import { buildOpenApiConfig } from '../openapi';

// Writes the OpenAPI document to a file without listening on a port.
// NestFactory.create() instantiates providers but never runs onModuleInit, so
// PrismaService does not connect and the database is never touched.
// Usage: npm run openapi:export [-- <output path>]
async function main() {
  const output = resolve(
    process.argv[2] ?? resolve(__dirname, '../../../../docs/api/openapi.json'),
  );
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error'],
  });
  app.setGlobalPrefix('api');
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(
    `OpenAPI written to ${output}: ${Object.keys(document.paths).length} paths, ` +
      `${Object.keys(document.components?.schemas ?? {}).length} schemas`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
