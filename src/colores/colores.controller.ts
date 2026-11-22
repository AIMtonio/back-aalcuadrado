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
  Query,
} from '@nestjs/common';
import { ColoresService } from './colores.service.js';
import {
  ActualizarColorDto,
  CrearColorDto,
  FiltroColoresDto,
} from './dto/datos-color.dto.js';

/** Colores de jabón y de vela. Se administran desde la pestaña Colores del panel. */
@Controller('colores')
export class ColoresController {
  constructor(private readonly colores: ColoresService) {}

  @Get()
  listar(@Query() filtro: FiltroColoresDto) {
    return this.colores.listar(filtro.pieza);
  }

  @Post()
  crear(@Body() datos: CrearColorDto) {
    return this.colores.crear(datos);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambios: ActualizarColorDto,
  ) {
    return this.colores.actualizar(id, cambios);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.colores.eliminar(id);
  }
}

/**
 * `GET /api/kits/colores`, como lo leía el front antes de separar los colores:
 * cada color sale con `enJabon` / `enVela` según su pieza. Solo lectura; se
 * puede quitar cuando el sincronizador del front use `/api/colores`.
 */
@Controller('kits')
export class ColoresKitsCompatController {
  constructor(private readonly colores: ColoresService) {}

  @Get('colores')
  async listar() {
    const lista = await this.colores.listar();
    return lista.map(({ pieza, ...color }) => ({
      ...color,
      enJabon: pieza === 'jabon',
      enVela: pieza === 'vela',
    }));
  }
}
