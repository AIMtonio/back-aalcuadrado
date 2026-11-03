import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Imagen } from '../imagenes/imagen.entity.js';
import { Producto, ProductoColor } from './producto.entity.js';
import { ProductosController } from './productos.controller.js';
import { ProductosService } from './productos.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Producto, ProductoColor, Imagen])],
  controllers: [ProductosController],
  providers: [ProductosService],
})
export class ProductosModule {}
