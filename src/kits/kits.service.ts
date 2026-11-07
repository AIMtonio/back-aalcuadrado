import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsWhere, Repository } from 'typeorm';
import { sinIndefinidos } from '../comun/sin-indefinidos.js';
import type {
  ActualizarAromaDto,
  ActualizarColorDto,
  CrearAromaDto,
  CrearColorDto,
} from './dto/datos-opcion.dto.js';
import { KitAroma, KitColor } from './opciones-kit.entity.js';

type Opcion = KitColor | KitAroma;

/** Cómo se nombra cada tipo en los mensajes de error. */
const NOMBRES = {
  color: { el: 'el color', un: 'un color' },
  aroma: { el: 'el aroma', un: 'un aroma' },
} as const;

/**
 * Colores y aromas que se pueden elegir al armar un kit (jabón + vela).
 * Los pedidos guardan el nombre, no el id: borrar o renombrar una opción no
 * cambia los pedidos que ya llegaron.
 */
@Injectable()
export class KitsService {
  constructor(
    @InjectRepository(KitColor) private readonly colores: Repository<KitColor>,
    @InjectRepository(KitAroma) private readonly aromas: Repository<KitAroma>,
  ) {}

  listarColores(): Promise<KitColor[]> {
    return this.colores.find({ order: { orden: 'ASC', nombre: 'ASC' } });
  }

  listarAromas(): Promise<KitAroma[]> {
    return this.aromas.find({ order: { orden: 'ASC', nombre: 'ASC' } });
  }

  crearColor(datos: CrearColorDto): Promise<KitColor> {
    return this.crear(this.colores, 'color', {
      ...this.base(datos),
      hex: datos.hex.toUpperCase(),
    });
  }

  crearAroma(datos: CrearAromaDto): Promise<KitAroma> {
    return this.crear(this.aromas, 'aroma', this.base(datos));
  }

  actualizarColor(id: number, cambios: ActualizarColorDto): Promise<KitColor> {
    return this.actualizar(this.colores, 'color', id, {
      ...cambios,
      ...(cambios.hex !== undefined && { hex: cambios.hex.toUpperCase() }),
    });
  }

  actualizarAroma(id: number, cambios: ActualizarAromaDto): Promise<KitAroma> {
    return this.actualizar(this.aromas, 'aroma', id, cambios);
  }

  async eliminarColor(id: number): Promise<void> {
    await this.buscar(this.colores, 'color', id);
    await this.colores.delete({ id });
  }

  async eliminarAroma(id: number): Promise<void> {
    await this.buscar(this.aromas, 'aroma', id);
    await this.aromas.delete({ id });
  }

  /** Valores por defecto de una opción nueva: para jabón y vela, disponible, al principio. */
  private base(datos: CrearAromaDto) {
    return {
      nombre: datos.nombre,
      enJabon: datos.enJabon ?? true,
      enVela: datos.enVela ?? true,
      disponible: datos.disponible ?? true,
      orden: datos.orden ?? 0,
    };
  }

  private async crear<T extends Opcion>(
    repo: Repository<T>,
    tipo: keyof typeof NOMBRES,
    datos: Partial<T>,
  ): Promise<T> {
    this.revisarPiezas(datos, tipo);
    await this.revisarNombreLibre(repo, tipo, datos.nombre!);
    return repo.save(repo.create(datos as T));
  }

  private async actualizar<T extends Opcion>(
    repo: Repository<T>,
    tipo: keyof typeof NOMBRES,
    id: number,
    cambios: Partial<T>,
  ): Promise<T> {
    const opcion = await this.buscar(repo, tipo, id);
    const nuevo = { ...opcion, ...sinIndefinidos(cambios) };
    this.revisarPiezas(nuevo, tipo);
    if (nuevo.nombre !== opcion.nombre) {
      await this.revisarNombreLibre(repo, tipo, nuevo.nombre, id);
    }
    return repo.save(repo.merge(opcion, sinIndefinidos(cambios) as T));
  }

  /** Una opción que no es ni para jabón ni para vela no aparecería en ningún lado. */
  private revisarPiezas(
    opcion: Partial<Opcion>,
    tipo: keyof typeof NOMBRES,
  ): void {
    if (!opcion.enJabon && !opcion.enVela) {
      throw new BadRequestException(
        `Marca si ${NOMBRES[tipo].el} es para el jabón, para la vela o para ambos`,
      );
    }
  }

  private async revisarNombreLibre<T extends Opcion>(
    repo: Repository<T>,
    tipo: keyof typeof NOMBRES,
    nombre: string,
    excepto?: number,
  ): Promise<void> {
    // Son pocas: se comparan aquí para ignorar mayúsculas y acentos igual en MySQL y en SQLite.
    const todas = await repo.find();
    const repetida = todas.find(
      (o) =>
        o.id !== excepto &&
        o.nombre.localeCompare(nombre, 'es', { sensitivity: 'base' }) === 0,
    );
    if (repetida) {
      throw new ConflictException(
        `Ya existe ${NOMBRES[tipo].un} llamado "${repetida.nombre}"`,
      );
    }
  }

  private async buscar<T extends Opcion>(
    repo: Repository<T>,
    tipo: keyof typeof NOMBRES,
    id: number,
  ): Promise<T> {
    const opcion = await repo.findOne({ where: { id } as FindOptionsWhere<T> });
    if (!opcion)
      throw new NotFoundException(`No existe ${NOMBRES[tipo].el} ${id}`);
    return opcion;
  }
}
