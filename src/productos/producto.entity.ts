import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  COLECCIONES,
  ETIQUETAS,
  type Coleccion,
  type Etiqueta,
} from './catalogo.js';

/** MySQL regresa DECIMAL como texto: se convierte a número al leer. */
const decimalANumero = {
  to: (valor: number | null) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

/** Tabla `productos`. Debe coincidir con database/01_crear_base_de_datos.sql. */
@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  /** Identificador en el front (enlaces, fotos). No cambia después de crearse. */
  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'simple-enum', enum: COLECCIONES })
  coleccion: Coleccion;

  @Column({ type: 'varchar', length: 240, default: '' })
  descripcion: string;

  @Column({ type: 'simple-enum', enum: ETIQUETAS, nullable: true })
  etiqueta: Etiqueta | null;

  @Column({
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
    transformer: decimalANumero,
  })
  precio: number | null;

  @Column({ type: 'boolean', default: true })
  disponible: boolean;

  @Column({ type: 'boolean', default: false })
  destacado: boolean;

  @Column({ type: 'int', nullable: true })
  orden: number | null;

  @OneToMany(() => ProductoColor, (color) => color.producto, { cascade: true })
  colores: ProductoColor[];

  @CreateDateColumn({ name: 'creado_en', type: 'datetime', precision: 6 })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime', precision: 6 })
  actualizadoEn: Date;
}

/** Tabla `producto_colores`: los colores en que se vende un producto. */
@Entity('producto_colores')
export class ProductoColor {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @ManyToOne(() => Producto, (producto) => producto.colores, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;

  /** Id del color en el front (`rosa-mexicano`). Es lo que guardan las fotos en `color`. */
  @Column({ name: 'color_id', type: 'varchar', length: 50 })
  colorId: string;

  @Column({ type: 'varchar', length: 50 })
  nombre: string;

  @Column({ type: 'varchar', length: 7 })
  hex: string;

  @Column({ type: 'int', default: 0 })
  orden: number;
}
