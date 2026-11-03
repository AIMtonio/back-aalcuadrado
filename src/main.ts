import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configurarApp } from './app.setup.js';
import type { Entorno } from './config/entorno.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarApp(app);

  const config = app.get<ConfigService<Entorno, true>>(ConfigService);
  const host = config.get('HOST', { infer: true });
  const puerto = config.get('PORT', { infer: true });
  await app.listen(puerto, host);
  Logger.log(
    `API en http://${host}:${puerto}/api · panel en http://${host}:${puerto}/panel/`,
    'Bootstrap',
  );
}
await bootstrap();
