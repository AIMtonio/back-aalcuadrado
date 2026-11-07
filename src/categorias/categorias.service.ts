import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { slugificar } from '../productos/catalogo.js';
import { Producto } from '../productos/producto.entity.js';
import { Categoria } from './categoria.entity.js';
import type {
  ActualizarCategoriaDto,
  CrearCategoriaDto,
} from './dto/datos-categoria.dto.js';

/** Una categoría tal como la devuelve la API. */
export type CategoriaRespuesta = Categoria & { totalProductos: number };

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria) private readonly repo: Repository<Categoria>,
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
  ) {}

  async listar(): Promise<CategoriaRespuesta[]> {
    const categorias = await this.repo.find({
      order: { orden: 'ASC', nombre: 'ASC' },
    });
    const conteo = await this.contarProductos();
    return categorias.map((c) => this.respuesta(c, conteo.get(c.id) ?? 0));
  }

  async obtener(slug: string): Promise<CategoriaRespuesta> {
    const categoria = await this.buscar(slug);
    const conteo = await this.contarProductos(categoria.id);
    return this.respuesta(categoria, conteo.get(categoria.id) ?? 0);
  }

  async crear(datos: CrearCategoriaDto): Promise<CategoriaRespuesta> {
    const slug = datos.slug || slugificar(datos.nombre);
    if (!slug) {
      throw new BadRequestException(
        'El nombre necesita letras o números para armar el slug',
      );
    }
    if (await this.repo.exists({ where: { slug } })) {
      throw new ConflictException(
        `Ya existe una categoría con el slug "${slug}"`,
      );
    }

    const categoria = this.repo.create({
      slug,
      nombre: datos.nombre.trim(),
      orden: datos.orden ?? 0,
    });
    await this.repo.save(categoria);
    return this.obtener(slug);
  }

  async actualizar(
    slug: string,
    cambios: ActualizarCategoriaDto,
  ): Promise<CategoriaRespuesta> {
    const categoria = await this.buscar(slug);
    if (cambios.nombre !== undefined) categoria.nombre = cambios.nombre.trim();
    if (cambios.orden !== undefined) categoria.orden = cambios.orden ?? 0;
    await this.repo.save(categoria);
    return this.obtener(slug);
  }

  /** No se borra una categoría con productos: primero hay que quitarles la categoría o cambiarla. */
  async eliminar(slug: string): Promise<void> {
    const categoria = await this.buscar(slug);
    const total = await this.productos.count({
      where: { categoriaId: categoria.id },
    });
    if (total > 0) {
      throw new ConflictException(
        `"${categoria.nombre}" tiene ${total} producto(s). Quítales la categoría antes de borrarla.`,
      );
    }
    await this.repo.delete({ id: categoria.id });
  }

  private async buscar(slug: string): Promise<Categoria> {
    const categoria = await this.repo.findOne({ where: { slug } });
    if (!categoria)
      throw new NotFoundException(`No existe la categoría "${slug}"`);
    return categoria;
  }

  private async contarProductos(categoriaId?: number): Promise<Map<number, number>> {
    const consulta = this.productos
      .createQueryBuilder('p')
      .select('p.categoriaId', 'categoriaId')
      .addSelect('COUNT(*)', 'total')
      .where('p.categoriaId IS NOT NULL')
      .groupBy('p.categoriaId');
    if (categoriaId) consulta.andWhere('p.categoriaId = :categoriaId', { categoriaId });
    const filas = await consulta.getRawMany<{
      categoriaId: number | string;
      total: string | number;
    }>();
    return new Map(filas.map((f) => [Number(f.categoriaId), Number(f.total)]));
  }

  private respuesta(categoria: Categoria, totalProductos: number): CategoriaRespuesta {
    return { ...categoria, totalProductos };
  }
}
