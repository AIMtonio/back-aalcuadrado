import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CrearProductoDto,
  ActualizarProductoDto,
} from './dto/datos-producto.dto.js';
import { ProductosService } from './productos.service.js';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Get()
  listar() {
    return this.productos.listar();
  }

  @Get(':slug')
  obtener(@Param('slug') slug: string) {
    return this.productos.obtener(slug);
  }

  @Post()
  crear(@Body() datos: CrearProductoDto) {
    return this.productos.crear(datos);
  }

  @Patch(':slug')
  actualizar(
    @Param('slug') slug: string,
    @Body() cambios: ActualizarProductoDto,
  ) {
    return this.productos.actualizar(slug, cambios);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('slug') slug: string) {
    return this.productos.eliminar(slug);
  }
}
