import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Publico } from '../auth/publico.decorator.js';
import { DisenosService } from './disenos.service.js';
import { GenerarDisenoDto } from './dto/generar-diseno.dto.js';

/**
 * Públicos para que el sitio los use sin iniciar sesión. Los protegen el límite
 * por IP, el cupo diario (OPENAI_MAX_IMAGENES_DIA) y CORS_ORIGINS.
 */
@Controller('disenos')
@Publico()
export class DisenosController {
  constructor(private readonly disenos: DisenosService) {}

  @Get()
  estado() {
    return this.disenos.estado();
  }

  /** Máximo 3 por IP cada 10 minutos: cada imagen cuesta. */
  @Post()
  @Throttle({ default: { limit: 3, ttl: 10 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  generar(@Body() { texto }: GenerarDisenoDto) {
    return this.disenos.generar(texto);
  }
}
