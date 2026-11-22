import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PIEZAS, type Pieza } from './piezas.js';

/**
 * Tabla `colores`. Debe coincidir con database/01_crear_base_de_datos.sql.
 * Un color de jabón o de vela. Las dos listas son independientes: el mismo
 * nombre puede estar en ambas con distinto tono.
 */
@Entity('colores')
@Index('uq_colores_pieza_nombre', ['pieza', 'nombre'], { unique: true })
export class Color {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  /** Para qué pieza es. No cambia después de crearlo. */
  @Column({ type: 'simple-enum', enum: PIEZAS })
  pieza: Pieza;

  /** Lo que ve el visitante y lo que guarda el pedido. Único dentro de su pieza. */
  @Column({ type: 'varchar', length: 60 })
  nombre: string;

  /** `#RRGGBB`, en mayúsculas. */
  @Column({ type: 'varchar', length: 7 })
  hex: string;

  /** Si es `false`, no sale en el sitio (por ejemplo, se acabó ese colorante). */
  @Column({ type: 'boolean', default: true })
  disponible: boolean;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime', precision: 6 })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime', precision: 6 })
  actualizadoEn: Date;
}
