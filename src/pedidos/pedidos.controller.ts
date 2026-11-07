import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Publico } from '../auth/publico.decorator.js';
import { CrearPedidoDto } from './dto/crear-pedido.dto.js';
import { PedidosService } from './pedidos.service.js';

@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  /**
   * Pública para que el front la use sin iniciar sesión. Sin catálogo ni precios:
   * el dueño cotiza y hace el pedido a mano desde la pestaña Pedidos del panel.
   */
  @Post()
  @Publico()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  crear(@Body() datos: CrearPedidoDto) {
    return this.pedidos.crear(datos);
  }

  /** Solo el panel: pide token. */
  @Get()
  listar() {
    return this.pedidos.listar();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.pedidos.eliminar(id);
  }
}
