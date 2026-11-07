import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Tabla `categorias`. Debe coincidir con database/01_crear_base_de_datos.sql. */
@Entity('categorias')
export class Categoria {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  /** Identificador en el front. No cambia después de crearse. */
  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime', precision: 6 })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime', precision: 6 })
  actualizadoEn: Date;
}
