import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
import type { Entorno } from '../config/entorno.js';
import { Producto, ProductoColor } from '../productos/producto.entity.js';
import { Imagen } from './imagen.entity.js';
import { ImagenesController, MAX_ARCHIVOS } from './imagenes.controller.js';
import { ImagenesService } from './imagenes.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Imagen, Producto, ProductoColor]),
    // Las fotos llegan a memoria: el servicio revisa sus bytes antes de escribirlas en disco.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Entorno, true>) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: config.get('UPLOADS_MAX_MB', { infer: true }) * 1024 * 1024,
          files: MAX_ARCHIVOS,
          fields: 20,
        },
      }),
    }),
  ],
  controllers: [ImagenesController],
  providers: [ImagenesService],
})
export class ImagenesModule {}
