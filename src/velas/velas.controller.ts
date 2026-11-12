import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Publico } from '../auth/publico.decorator.js';
import { CrearPedidoVelaDto } from './dto/crear-pedido-vela.dto.js';
import {
  ActualizarPresentacionDto,
  CrearPresentacionDto,
} from './dto/datos-presentacion.dto.js';
import { VelasService } from './velas.service.js';

/**
 * Velas individuales. Las presentaciones se administran desde la pestaña Velas
 * del panel; el front las descarga al compilar (con token) y manda los pedidos.
 */
@Controller('velas')
export class VelasController {
  constructor(private readonly velas: VelasService) {}

  @Get('presentaciones')
  listarPresentaciones() {
    return this.velas.listarPresentaciones();
  }

  @Post('presentaciones')
  crearPresentacion(@Body() datos: CrearPresentacionDto) {
    return this.velas.crearPresentacion(datos);
  }

  @Patch('presentaciones/:id')
  actualizarPresentacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambios: ActualizarPresentacionDto,
  ) {
    return this.velas.actualizarPresentacion(id, cambios);
  }

  @Delete('presentaciones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarPresentacion(@Param('id', ParseIntPipe) id: number) {
    return this.velas.eliminarPresentacion(id);
  }

  /** Pública para el front, sin iniciar sesión. Sin precios: el dueño cotiza a mano. */
  @Post('pedidos')
  @Publico()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  crearPedido(@Body() datos: CrearPedidoVelaDto) {
    return this.velas.crearPedido(datos);
  }

  /** Solo el panel: pide token. */
  @Get('pedidos')
  listarPedidos() {
    return this.velas.listarPedidos();
  }

  @Delete('pedidos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarPedido(@Param('id', ParseIntPipe) id: number) {
    return this.velas.eliminarPedido(id);
  }
}
