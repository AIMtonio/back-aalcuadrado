import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Categoria } from '../categorias/categoria.entity.js';
import { Imagen } from '../imagenes/imagen.entity.js';
import { Producto, ProductoColor } from './producto.entity.js';
import { ProductosController } from './productos.controller.js';
import { ProductosService } from './productos.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Producto, ProductoColor, Imagen, Categoria]),
  ],
  controllers: [ProductosController],
  providers: [ProductosService],
})
export class ProductosModule {}
