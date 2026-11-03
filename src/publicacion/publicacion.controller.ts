import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicacionService } from './publicacion.service.js';

@Controller('publicacion')
export class PublicacionController {
  constructor(private readonly publicacion: PublicacionService) {}

  @Get()
  estado() {
    return this.publicacion.estado();
  }

  /** Vuelve a publicar el front. Máximo 3 por minuto: cada una es un build completo. */
  @Post()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  publicar() {
    return this.publicacion.publicar();
  }
}
