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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ActualizarImagenDto,
  FiltroImagenesDto,
  SubirImagenesDto,
} from './dto/datos-imagen.dto.js';
import { ImagenesService } from './imagenes.service.js';

/** Máximo de fotos por petición. */
export const MAX_ARCHIVOS = 10;

@Controller('imagenes')
export class ImagenesController {
  constructor(private readonly imagenes: ImagenesService) {}

  /** `GET /api/imagenes?categoria=galeria&producto=nochebuena` (ambos filtros son opcionales). */
  @Get()
  listar(@Query() filtro: FiltroImagenesDto) {
    return this.imagenes.listar(filtro);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.imagenes.obtener(id);
  }

  /** `multipart/form-data` con uno o varios `archivos` y los campos de `SubirImagenesDto`. */
  @Post()
  @UseInterceptors(FilesInterceptor('archivos', MAX_ARCHIVOS))
  subir(
    @UploadedFiles() archivos: Express.Multer.File[],
    @Body() datos: SubirImagenesDto,
  ) {
    return this.imagenes.subir(archivos, datos);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambios: ActualizarImagenDto,
  ) {
    return this.imagenes.actualizar(id, cambios);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.imagenes.eliminar(id);
  }
}
