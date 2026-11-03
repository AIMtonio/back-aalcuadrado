import { Module } from '@nestjs/common';
import { PublicacionController } from './publicacion.controller.js';
import { PublicacionService } from './publicacion.service.js';

@Module({
  controllers: [PublicacionController],
  providers: [PublicacionService],
})
export class PublicacionModule {}
