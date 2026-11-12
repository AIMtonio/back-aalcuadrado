import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TIPOS_VELA, type TipoVela } from './tipos-vela.js';

/**
 * Tabla `velas_presentaciones`. Debe coincidir con database/01_crear_base_de_datos.sql.
 * Un tamaño (Pequeña, Mediana, Grande) o un molde (Cupcake) de un tipo de vela.
 */
@Entity('velas_presentaciones')
@Index('uq_velas_presentaciones_tipo_nombre', ['tipo', 'nombre'], {
  unique: true,
})
export class PresentacionVela {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'simple-enum', enum: TIPOS_VELA })
  tipo: TipoVela;

  /** "Pequeña", "Mediana", "Grande" o el nombre del molde ("Cupcake"). Lo guarda el pedido. */
  @Column({ type: 'varchar', length: 40 })
  nombre: string;

  /** Gramos de cera. `null` mientras no se haya definido. */
  @Column({ type: 'int', unsigned: true, nullable: true })
  gramos: number | null;

  /** Se puede pedir marmoleada. Nunca en jícara. */
  @Column({ type: 'boolean', default: false })
  marmoleable: boolean;

  /** Si es `false`, no sale en el sitio y no se aceptan pedidos de ella. */
  @Column({ type: 'boolean', default: true })
  disponible: boolean;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime', precision: 6 })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime', precision: 6 })
  actualizadoEn: Date;
}
