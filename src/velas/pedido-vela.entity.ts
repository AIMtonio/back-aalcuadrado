import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TIPOS_VELA, type TipoVela } from './tipos-vela.js';

/**
 * Tabla `pedidos_velas`. Debe coincidir con database/01_crear_base_de_datos.sql.
 * Una vela personalizada que alguien pidió desde el front. Guarda los nombres
 * elegidos (no ids): cambiar o borrar una opción no altera los pedidos.
 */
@Entity('pedidos_velas')
export class PedidoVela {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'cliente_nombre', type: 'varchar', length: 100 })
  clienteNombre: string;

  /** Correo o teléfono de quien pidió, para poder contactarlo. */
  @Column({ name: 'cliente_contacto', type: 'varchar', length: 150 })
  clienteContacto: string;

  @Column({ type: 'simple-enum', enum: TIPOS_VELA })
  tipo: TipoVela;

  /** Tamaño o molde, como se llamaba al pedir. */
  @Column({ type: 'varchar', length: 40 })
  presentacion: string;

  /** Los gramos que tenía la presentación al pedir (`null` si no estaban definidos). */
  @Column({ type: 'int', unsigned: true, nullable: true })
  gramos: number | null;

  @Column({ type: 'varchar', length: 60 })
  color: string;

  @Column({ type: 'varchar', length: 60 })
  aroma: string;

  @Column({ type: 'varchar', length: 60 })
  topping: string;

  @Column({ type: 'boolean', default: false })
  marmoleado: boolean;

  /** El segundo color de la veta; solo si es marmoleada. */
  @Column({
    name: 'color_marmoleado',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  colorMarmoleado: string | null;

  @Column({ type: 'int', unsigned: true, default: 1 })
  cantidad: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notas: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime', precision: 6 })
  creadoEn: Date;
}
