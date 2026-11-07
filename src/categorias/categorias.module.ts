import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from '../productos/producto.entity.js';
import { Categoria } from './categoria.entity.js';
import { CategoriasController } from './categorias.controller.js';
import { CategoriasService } from './categorias.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Categoria, Producto])],
  controllers: [CategoriasController],
  providers: [CategoriasService],
})
export class CategoriasModule {}
