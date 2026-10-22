import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CATEGORIAS, type Categoria } from './categorias.js';

/** Tabla `imagenes`. Debe coincidir con database/01_crear_base_de_datos.sql. */
@Entity('imagenes')
@Index('idx_imagenes_categoria_producto', ['categoria', 'producto'])
export class Imagen {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'simple-enum', enum: CATEGORIAS })
  categoria: Categoria;

  /** Nombre del archivo dentro de `UPLOADS_DIR/<categoria>/`. Lo genera la API. */
  @Column({ type: 'varchar', length: 120, unique: true })
  archivo: string;

  @Column({ name: 'nombre_original', type: 'varchar', length: 255 })
  nombreOriginal: string;

  @Column({ type: 'varchar', length: 20 })
  mime: string;

  @Column({ name: 'tamano_bytes', type: 'int', unsigned: true })
  tamanoBytes: number;

  /** Texto alternativo para lectores de pantalla. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  alt: string | null;

  /** Slug del producto en el front (por ejemplo `nochebuena`), si la foto es de un producto. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  producto: string | null;

  /** Id del color en el front (por ejemplo `rojo`), si la foto es de un color en particular. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  color: string | null;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime', precision: 6 })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime', precision: 6 })
  actualizadoEn: Date;
}
