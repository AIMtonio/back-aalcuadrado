import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Publico } from '../auth/publico.decorator.js';
import { ipDelVisitante } from '../comun/ip-visitante.js';
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

  /**
   * Cuántos diseños puede crear cada visitante lo decide el servicio
   * (OPENAI_MAX_IMAGENES_VISITANTE por hora, solo cuentan los que salen bien).
   * Este límite solo frena a quien manda peticiones sin parar.
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  generar(@Body() { texto }: GenerarDisenoDto, @Req() req: Request) {
    return this.disenos.generar(texto, ipDelVisitante(req));
  }
}
