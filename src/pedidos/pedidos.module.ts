import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PedidoKit } from './pedido-kit.entity.js';
import { PedidosController } from './pedidos.controller.js';
import { PedidosService } from './pedidos.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PedidoKit])],
  controllers: [PedidosController],
  providers: [PedidosService],
})
export class PedidosModule {}
