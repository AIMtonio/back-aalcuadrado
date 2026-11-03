import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CalidadImagen, Entorno } from '../config/entorno.js';
import { construirPrompt } from './prompt.js';

export interface Diseno {
  /** La imagen lista para `<img src>`: `data:image/webp;base64,…`. */
  imagen: string;
  /** Cuántas imágenes quedan hoy, entre todos los visitantes. */
  restantesHoy: number;
}

export interface EstadoDisenos {
  /** `false` si no hay OPENAI_API_KEY o ya se acabó el cupo del día: el front oculta el formulario. */
  disponible: boolean;
  restantesHoy: number;
}

const FORMATO = 'webp';
const TAMANO = '1024x1024';
/**
 * Cuánto se espera a OpenAI. Cloudflare corta en 100 s las respuestas que pasan
 * por el túnel, así que conviene contestar antes con un error claro.
 */
const TIEMPO_MAXIMO_MS = 90_000;

/** "2026-11-02", con la fecha de la Ciudad de México: el cupo se renueva a medianoche de allá. */
const hoy = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

/** Genera con OpenAI la imagen de unos aretes a partir de la idea de un visitante. */
@Injectable()
export class DisenosService {
  private readonly logger = new Logger(DisenosService.name);
  private readonly llave: string | null;
  private readonly modelo: string;
  private readonly calidad: CalidadImagen;
  private readonly maximoDiario: number;
  private readonly baseUrl: string;

  // El cupo vive en memoria: se reinicia si la API se reinicia.
  private dia = hoy();
  private usadasHoy = 0;

  constructor(config: ConfigService<Entorno, true>) {
    this.llave = config.get('OPENAI_API_KEY', { infer: true });
    this.modelo = config.get('OPENAI_MODELO_IMAGEN', { infer: true });
    this.calidad = config.get('OPENAI_CALIDAD_IMAGEN', { infer: true });
    this.maximoDiario = config.get('OPENAI_MAX_IMAGENES_DIA', { infer: true });
    this.baseUrl = config.get('OPENAI_BASE_URL', { infer: true });
  }

  estado(): EstadoDisenos {
    const restantesHoy = this.restantes();
    return {
      disponible: this.llave !== null && restantesHoy > 0,
      restantesHoy,
    };
  }

  async generar(texto: string): Promise<Diseno> {
    if (!this.llave) {
      throw new ServiceUnavailableException(
        'La generación de diseños no está disponible por ahora.',
      );
    }
    if (this.restantes() === 0) {
      throw new HttpException(
        'Por hoy ya se generaron todos los diseños disponibles. Intenta mañana.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Se aparta el lugar antes de llamar (por si llegan varias a la vez) y se devuelve si falla.
    this.usadasHoy++;
    try {
      const b64 = await this.pedirImagen(construirPrompt(texto), this.llave);
      return {
        imagen: `data:image/${FORMATO};base64,${b64}`,
        restantesHoy: this.restantes(),
      };
    } catch (error) {
      this.usadasHoy = Math.max(0, this.usadasHoy - 1);
      throw error;
    }
  }

  private restantes(): number {
    const dia = hoy();
    if (dia !== this.dia) {
      this.dia = dia;
      this.usadasHoy = 0;
    }
    return Math.max(0, this.maximoDiario - this.usadasHoy);
  }

  /** Llama a `POST /images/generations` y regresa la imagen en base64. */
  private async pedirImagen(prompt: string, llave: string): Promise<string> {
    let respuesta: Response;
    try {
      respuesta = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${llave}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelo,
          prompt,
          n: 1,
          size: TAMANO,
          quality: this.calidad,
          output_format: FORMATO,
        }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
    } catch (error) {
      this.logger.warn(`OpenAI no respondió: ${(error as Error).message}`);
      throw new BadGatewayException(
        'La IA tardó demasiado en responder. Intenta de nuevo.',
      );
    }

    const cuerpo = (await respuesta.json().catch(() => null)) as {
      data?: { b64_json?: unknown }[];
      error?: { code?: unknown; message?: unknown };
    } | null;

    if (!respuesta.ok) {
      const codigo = String(cuerpo?.error?.code ?? '');
      this.logger.warn(
        `OpenAI respondió ${respuesta.status} (${codigo || 'sin código'}): ${String(cuerpo?.error?.message ?? '')}`,
      );
      if (
        codigo === 'moderation_blocked' ||
        codigo === 'content_policy_violation'
      ) {
        throw new UnprocessableEntityException(
          'La IA no puede dibujar esa idea. Prueba describiéndola de otra forma.',
        );
      }
      if ([401, 403, 429].includes(respuesta.status)) {
        // Llave inválida, sin permisos o sin saldo: no es culpa del visitante.
        throw new ServiceUnavailableException(
          'La generación de diseños no está disponible por ahora.',
        );
      }
      throw new BadGatewayException(
        'La IA no pudo generar el diseño. Intenta de nuevo.',
      );
    }

    const b64 = cuerpo?.data?.[0]?.b64_json;
    if (typeof b64 !== 'string' || b64.length === 0) {
      this.logger.warn('OpenAI respondió sin imagen');
      throw new BadGatewayException(
        'La IA no pudo generar el diseño. Intenta de nuevo.',
      );
    }
    this.logger.log(`Diseño generado (${this.modelo}, ${this.calidad})`);
    return b64;
  }
}
