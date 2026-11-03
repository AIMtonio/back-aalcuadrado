import { fileURLToPath } from 'node:url';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { Entorno } from './config/entorno.js';

/** Carpeta `public/` del proyecto (el panel). Se resuelve igual desde `src/` y desde `dist/`. */
const CARPETA_PUBLICA = fileURLToPath(new URL('../public', import.meta.url));

/** Middlewares, prefijo y archivos estáticos. Lo usan `main.ts` y las pruebas e2e. */
export function configurarApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Entorno, true>>(ConfigService);
  const produccion = config.get('NODE_ENV', { infer: true }) === 'production';

  // cloudflared va delante de la API: se confía en su X-Forwarded-For para saber la IP real.
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Las fotos se muestran desde el dominio del front, no desde el de la API.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          imgSrc: ["'self'", 'data:', 'blob:'],
          upgradeInsecureRequests: produccion ? [] : null,
        },
      },
    }),
  );

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Archivos estáticos (fuera de /api y sin token, para que <img src> funcione en el front).
  app.useStaticAssets(config.get('UPLOADS_DIR', { infer: true }), {
    prefix: '/uploads',
    index: false,
    dotfiles: 'ignore',
    maxAge: '30d',
    immutable: true,
  });
  app.useStaticAssets(CARPETA_PUBLICA, {
    index: 'index.html',
    dotfiles: 'ignore',
  });

  app.enableShutdownHooks();
}
