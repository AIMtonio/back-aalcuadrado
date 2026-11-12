import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitAroma, KitColor } from '../kits/opciones-kit.entity.js';
import { PedidoVela } from './pedido-vela.entity.js';
import { PresentacionVela } from './presentacion-vela.entity.js';
import { VelasController } from './velas.controller.js';
import { VelasService } from './velas.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PresentacionVela,
      PedidoVela,
      KitColor,
      KitAroma,
    ]),
  ],
  controllers: [VelasController],
  providers: [VelasService],
})
export class VelasModule {}
