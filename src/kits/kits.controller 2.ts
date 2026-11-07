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
import {
  ActualizarAromaDto,
  ActualizarColorDto,
  CrearAromaDto,
  CrearColorDto,
} from './dto/datos-opcion.dto.js';
import { KitsService } from './kits.service.js';

/** Colores y aromas para armar los kits. Se administran desde la pestaña Kits del panel. */
@Controller('kits')
export class KitsController {
  constructor(private readonly kits: KitsService) {}

  @Get('colores')
  listarColores() {
    return this.kits.listarColores();
  }

  @Post('colores')
  crearColor(@Body() datos: CrearColorDto) {
    return this.kits.crearColor(datos);
  }

  @Patch('colores/:id')
  actualizarColor(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambios: ActualizarColorDto,
  ) {
    return this.kits.actualizarColor(id, cambios);
  }

  @Delete('colores/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarColor(@Param('id', ParseIntPipe) id: number) {
    return this.kits.eliminarColor(id);
  }

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
