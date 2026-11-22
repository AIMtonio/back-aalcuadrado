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
import { ActualizarAromaDto, CrearAromaDto } from './dto/datos-opcion.dto.js';
import { KitsService } from './kits.service.js';

/**
 * Aromas para armar los kits (y las velas). Se administran desde la pestaña Kits
 * del panel. Los colores están en `/api/colores`, separados por pieza.
 */
@Controller('kits')
export class KitsController {
  constructor(private readonly kits: KitsService) {}

  @Get('aromas')
  listarAromas() {
    return this.kits.listarAromas();
  }

  @Post('aromas')
  crearAroma(@Body() datos: CrearAromaDto) {
    return this.kits.crearAroma(datos);
  }

  @Patch('aromas/:id')
  actualizarAroma(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambios: ActualizarAromaDto,
  ) {
    return this.kits.actualizarAroma(id, cambios);
  }

  @Delete('aromas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarAroma(@Param('id', ParseIntPipe) id: number) {
    return this.kits.eliminarAroma(id);
  }
}
