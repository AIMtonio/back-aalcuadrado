import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ColoresModule } from '../colores/colores.module.js';
import { KitAroma } from '../kits/opciones-kit.entity.js';
import { PedidoVela } from './pedido-vela.entity.js';
import { PresentacionVela } from './presentacion-vela.entity.js';
import { VelasController } from './velas.controller.js';
import { VelasService } from './velas.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PresentacionVela, PedidoVela, KitAroma]),
    ColoresModule,
  ],
  controllers: [VelasController],
  providers: [VelasService],
})
export class VelasModule {}
