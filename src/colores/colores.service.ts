import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { sinIndefinidos } from '../comun/sin-indefinidos.js';
import { Color } from './color.entity.js';
import type {
  ActualizarColorDto,
  CrearColorDto,
} from './dto/datos-color.dto.js';
import { NOMBRES_PIEZA, PIEZAS, type Pieza } from './piezas.js';

/**
 * Colores de jabón y de vela, en listas separadas. Los pedidos guardan el
 * nombre, no el id: borrar o renombrar un color no cambia los pedidos.
 */
@Injectable()
export class ColoresService {
  constructor(
    @InjectRepository(Color) private readonly colores: Repository<Color>,
  ) {}

  /** Primero los de jabón y luego los de vela; dentro de cada uno, por `orden` y nombre. */
  async listar(pieza?: Pieza): Promise<Color[]> {
    const lista = await this.colores.find({
      where: sinIndefinidos({ pieza }),
      order: { orden: 'ASC', nombre: 'ASC' },
    });
    return lista.sort(
      (a, b) => PIEZAS.indexOf(a.pieza) - PIEZAS.indexOf(b.pieza),
    );
  }

  /** Los que se pueden elegir hoy para una pieza (para validar pedidos). */
  disponibles(pieza: Pieza): Promise<Color[]> {
    return this.colores.find({ where: { pieza, disponible: true } });
  }

  async crear(datos: CrearColorDto): Promise<Color> {
    await this.revisarNombreLibre(datos.pieza, datos.nombre);
    return this.colores.save(
      this.colores.create({
        pieza: datos.pieza,
        nombre: datos.nombre,
        hex: datos.hex.toUpperCase(),
        disponible: datos.disponible ?? true,
        orden: datos.orden ?? 0,
      }),
    );
  }

  async actualizar(id: number, cambios: ActualizarColorDto): Promise<Color> {
    const color = await this.buscar(id);
    const limpios = sinIndefinidos({
      ...cambios,
      hex: cambios.hex?.toUpperCase(),
    });
    if (limpios.nombre !== undefined && limpios.nombre !== color.nombre) {
      await this.revisarNombreLibre(color.pieza, limpios.nombre, id);
    }
    return this.colores.save(this.colores.merge(color, limpios));
  }

  async eliminar(id: number): Promise<void> {
    await this.buscar(id);
    await this.colores.delete({ id });
  }

  private async revisarNombreLibre(
    pieza: Pieza,
    nombre: string,
    excepto?: number,
  ): Promise<void> {
    // Son pocos: se comparan aquí para ignorar mayúsculas y acentos igual en MySQL y en SQLite.
    const dePieza = await this.colores.find({ where: { pieza } });
    const repetido = dePieza.find(
      (c) =>
        c.id !== excepto &&
        c.nombre.localeCompare(nombre, 'es', { sensitivity: 'base' }) === 0,
    );
    if (repetido) {
      throw new ConflictException(
        `Ya existe un color de ${NOMBRES_PIEZA[pieza]} llamado "${repetido.nombre}"`,
      );
    }
  }

  private async buscar(id: number): Promise<Color> {
    const color = await this.colores.findOne({ where: { id } });
    if (!color) throw new NotFoundException(`No existe el color ${id}`);
    return color;
  }
}
