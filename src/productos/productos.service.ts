import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, type Repository } from 'typeorm';
import { Imagen } from '../imagenes/imagen.entity.js';
import { slugificar } from './catalogo.js';
import type {
  ActualizarProductoDto,
  ColorDto,
  CrearProductoDto,
} from './dto/datos-producto.dto.js';
import { Producto, ProductoColor } from './producto.entity.js';

/** Un color tal como lo devuelve la API (y como lo espera el front). */
export interface ColorRespuesta {
  id: string;
  nombre: string;
  hex: string;
}

/** Un producto tal como lo devuelve la API. */
export type ProductoRespuesta = Omit<Producto, 'colores'> & {
  colores: ColorRespuesta[];
  totalFotos: number;
};

/** Normaliza la lista de colores: calcula los ids que faltan y revisa que no se repitan. */
function revisarColores(colores: ColorDto[]): ColorRespuesta[] {
  const lista = colores.map((c) => ({
    id: c.id || slugificar(c.nombre),
    nombre: c.nombre.trim(),
    hex: c.hex.toUpperCase(),
  }));
  for (const color of lista) {
    if (!color.id)
      throw new BadRequestException(
        `El color "${color.nombre}" necesita letras o números en su nombre`,
      );
  }
  const repetido = lista.find(
    (c, i) => lista.findIndex((o) => o.id === c.id) !== i,
  );
  if (repetido)
    throw new BadRequestException(`Hay dos colores con el id "${repetido.id}"`);
  return lista;
}

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto) private readonly repo: Repository<Producto>,
    @InjectRepository(Imagen) private readonly imagenes: Repository<Imagen>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async listar(): Promise<ProductoRespuesta[]> {
    const productos = await this.repo.find({
      relations: { colores: true },
      order: { nombre: 'ASC', colores: { orden: 'ASC', id: 'ASC' } },
    });
    const conteo = await this.contarFotos();
    return productos.map((p) => this.respuesta(p, conteo.get(p.slug) ?? 0));
  }

  async obtener(slug: string): Promise<ProductoRespuesta> {
    const producto = await this.buscar(slug);
    return this.respuesta(
      producto,
      (await this.contarFotos(slug)).get(slug) ?? 0,
    );
  }

  async crear(datos: CrearProductoDto): Promise<ProductoRespuesta> {
    const slug = datos.slug || slugificar(datos.nombre);
    if (!slug)
      throw new BadRequestException(
        'El nombre necesita letras o números para armar el slug',
      );
    if (await this.repo.exists({ where: { slug } })) {
      throw new ConflictException(
        `Ya existe un producto con el slug "${slug}"`,
      );
    }

    const producto = this.repo.create({
      slug,
      nombre: datos.nombre.trim(),
      coleccion: datos.coleccion,
      descripcion: datos.descripcion?.trim() ?? '',
      etiqueta: datos.etiqueta ?? null,
      precio: datos.precio ?? null,
      disponible: datos.disponible ?? true,
      destacado: datos.destacado ?? false,
      orden: datos.orden ?? null,
      colores: this.filasDeColores(revisarColores(datos.colores ?? [])),
    });
    await this.repo.save(producto);
    return this.obtener(slug);
  }

  /**
   * Edita el producto. Si llegan `colores`, reemplazan a los anteriores; las fotos
   * que estaban en un color que ya no existe se quedan sin color (el sitio las muestra igual).
   */
  async actualizar(
    slug: string,
    cambios: ActualizarProductoDto,
  ): Promise<ProductoRespuesta> {
    const producto = await this.buscar(slug);
    const { colores, ...resto } = cambios;
    for (const [campo, valor] of Object.entries(resto)) {
      if (valor === undefined) continue;
      (producto as unknown as Record<string, unknown>)[campo] =
        typeof valor === 'string' ? valor.trim() : valor;
    }

    await this.dataSource.transaction(async (tx) => {
      if (colores) {
        const nuevos = revisarColores(colores);
        await tx
          .createQueryBuilder()
          .delete()
          .from(ProductoColor)
          .where('producto_id = :id', { id: producto.id })
          .execute();
        producto.colores = this.filasDeColores(nuevos);
        await tx.update(
          Imagen,
          nuevos.length > 0
            ? { producto: slug, color: Not(In(nuevos.map((c) => c.id))) }
            : { producto: slug },
          { color: null },
        );
      }
      await tx.save(producto);
    });
    return this.obtener(slug);
  }

  /** No se borra un producto con fotos: primero hay que borrarlas o pasarlas a otro producto. */
  async eliminar(slug: string): Promise<void> {
    const producto = await this.buscar(slug);
    const fotos = await this.imagenes.count({ where: { producto: slug } });
    if (fotos > 0) {
      throw new ConflictException(
        `"${producto.nombre}" tiene ${fotos} foto(s). Bórralas o pásalas a otro producto antes de borrarlo.`,
      );
    }
    await this.repo.delete({ id: producto.id });
  }

  private async buscar(slug: string): Promise<Producto> {
    const producto = await this.repo.findOne({
      where: { slug },
      relations: { colores: true },
      order: { colores: { orden: 'ASC', id: 'ASC' } },
    });
    if (!producto)
      throw new NotFoundException(`No existe el producto "${slug}"`);
    return producto;
  }

  private filasDeColores(colores: ColorRespuesta[]): ProductoColor[] {
    return colores.map((c, orden) =>
      Object.assign(new ProductoColor(), {
        colorId: c.id,
        nombre: c.nombre,
        hex: c.hex,
        orden,
      }),
    );
  }

  private async contarFotos(slug?: string): Promise<Map<string, number>> {
    const consulta = this.imagenes
      .createQueryBuilder('i')
      .select('i.producto', 'producto')
      .addSelect('COUNT(*)', 'total')
      .where('i.producto IS NOT NULL')
      .groupBy('i.producto');
    if (slug) consulta.andWhere('i.producto = :slug', { slug });
    const filas = await consulta.getRawMany<{
      producto: string;
      total: string | number;
    }>();
    return new Map(filas.map((f) => [f.producto, Number(f.total)]));
  }

  private respuesta(producto: Producto, totalFotos: number): ProductoRespuesta {
    const { colores, ...resto } = producto;
    return {
      ...resto,
      colores: (colores ?? []).map((c) => ({
        id: c.colorId,
        nombre: c.nombre,
        hex: c.hex,
      })),
      totalFotos,
    };
  }
}
