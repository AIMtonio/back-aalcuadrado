import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Lo que tiene una opción de kit: para qué pieza sirve y si se ofrece. */
abstract class OpcionKit {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  /** Lo que ve el visitante y lo que guarda el pedido. Único en su tabla. */
  @Column({ type: 'varchar', length: 60, unique: true })
  nombre: string;

  /** Se ofrece para el jabón. */
  @Column({ name: 'en_jabon', type: 'boolean', default: true })
  enJabon: boolean;

  /** Se ofrece para la vela. */
  @Column({ name: 'en_vela', type: 'boolean', default: true })
  enVela: boolean;

  /** Si es `false`, no sale en el sitio (por ejemplo, se acabó ese material). */
  @Column({ type: 'boolean', default: true })
  disponible: boolean;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime', precision: 6 })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime', precision: 6 })
  actualizadoEn: Date;
}

/** Tabla `kit_aromas`. Debe coincidir con database/01_crear_base_de_datos.sql. */
@Entity('kit_aromas')
export class KitAroma extends OpcionKit {}
