import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Entorno } from '../config/entorno.js';

export interface Publicacion {
  /** Cuándo se pidió al proveedor (Vercel, Netlify…) que vuelva a publicar el sitio. */
  solicitadaEn: string;
  /** Id del build que devolvió el proveedor, si lo devolvió. */
  build: string | null;
}

export interface EstadoPublicacion {
  /** `false` si no hay DEPLOY_HOOK_URL: el panel oculta el botón. */
  configurada: boolean;
  /** La última publicación pedida desde que arrancó la API. */
  ultima: Publicacion | null;
}

/** Cuánto se espera la respuesta del Deploy Hook. */
const TIEMPO_MAXIMO_MS = 15_000;

/**
 * Vuelve a publicar el front llamando a su Deploy Hook. El build del front
 * corre `npm run api:sincronizar`, que descarga los productos y fotos actuales.
 */
@Injectable()
export class PublicacionService {
  private readonly logger = new Logger(PublicacionService.name);
  private readonly hook: string | null;
  private ultima: Publicacion | null = null;

  constructor(config: ConfigService<Entorno, true>) {
    this.hook = config.get('DEPLOY_HOOK_URL', { infer: true });
  }

  estado(): EstadoPublicacion {
    return { configurada: this.hook !== null, ultima: this.ultima };
  }

  async publicar(): Promise<Publicacion> {
    if (!this.hook) {
      throw new ServiceUnavailableException(
        'No hay DEPLOY_HOOK_URL configurado en la API: no se puede publicar desde el panel.',
      );
    }

    let respuesta: Response;
    try {
      respuesta = await fetch(this.hook, {
        method: 'POST',
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
    } catch (error) {
      this.logger.warn(
        `El Deploy Hook no respondió: ${(error as Error).message}`,
      );
      throw new BadGatewayException(
        'El servicio de publicación no respondió. Intenta de nuevo en un momento.',
      );
    }
    if (!respuesta.ok) {
      this.logger.warn(`El Deploy Hook respondió ${respuesta.status}`);
      throw new BadGatewayException(
        `El servicio de publicación respondió ${respuesta.status}. Revisa que DEPLOY_HOOK_URL siga vigente.`,
      );
    }

    // Vercel responde { job: { id, state, createdAt } }; otros proveedores, otra cosa o nada.
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      job?: { id?: unknown };
    } | null;
    const build = typeof cuerpo?.job?.id === 'string' ? cuerpo.job.id : null;

    this.ultima = { solicitadaEn: new Date().toISOString(), build };
    this.logger.log(
      `Publicación solicitada${build ? ` (build ${build})` : ''}`,
    );
    return this.ultima;
  }
}
