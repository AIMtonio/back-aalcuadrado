import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import type { Entorno } from './config/entorno.js';

/** Carpeta `public/` del proyecto (el panel). Se resuelve igual desde `src/` y desde `dist/`. */
const CARPETA_PUBLICA = fileURLToPath(new URL('../public', import.meta.url));

/**
 * `index.html` del panel con `panel.js?v=<huella>` y `panel.css?v=<huella>`.
 * Cloudflare guarda .js y .css en el navegador por horas: con la huella en la
 * URL, cada versión nueva del panel se descarga en cuanto se publica.
 */
function paginaDelPanel(): string {
  const carpeta = join(CARPETA_PUBLICA, 'panel');
  const huella = (archivo: string) =>
    createHash('sha256')
      .update(readFileSync(join(carpeta, archivo)))
      .digest('hex')
      .slice(0, 10);
  return readFileSync(join(carpeta, 'index.html'), 'utf8')
    .replace('href="panel.css"', `href="panel.css?v=${huella('panel.css')}"`)
    .replace('src="panel.js"', `src="panel.js?v=${huella('panel.js')}"`);
}

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
  // El HTML del panel nunca se guarda en caché: es el que apunta a la versión vigente del JS y el CSS.
  const panel = paginaDelPanel();
  app
    .getHttpAdapter()
    .getInstance()
    .get(['/panel', '/panel/index.html'], (req: Request, res: Response) => {
      // Sin la "/" final, "panel.js" se buscaría en la raíz del dominio.
      if (req.path === '/panel') return res.redirect(301, '/panel/');
      res.set('Cache-Control', 'no-cache').type('html').send(panel);
    });
  app.useStaticAssets(CARPETA_PUBLICA, {
    index: 'index.html',
    dotfiles: 'ignore',
  });

  app.enableShutdownHooks();
}
