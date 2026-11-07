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
import { CategoriasService } from './categorias.service.js';
import {
  ActualizarCategoriaDto,
  CrearCategoriaDto,
} from './dto/datos-categoria.dto.js';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categorias: CategoriasService) {}

  @Get()
  listar() {
    return this.categorias.listar();
  }

  @Get(':slug')
  obtener(@Param('slug') slug: string) {
    return this.categorias.obtener(slug);
  }

  @Post()
  crear(@Body() datos: CrearCategoriaDto) {
    return this.categorias.crear(datos);
  }

  @Patch(':slug')
  actualizar(
    @Param('slug') slug: string,
    @Body() cambios: ActualizarCategoriaDto,
  ) {
    return this.categorias.actualizar(slug, cambios);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('slug') slug: string) {
    return this.categorias.eliminar(slug);
  }
}
