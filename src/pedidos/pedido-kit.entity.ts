import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Tabla `pedidos_kits`. Debe coincidir con database/01_crear_base_de_datos.sql.
 * Un pedido de kit (jabón + vela) que llega desde el front; el dueño lo cotiza
 * y lo hace a mano desde la pestaña Pedidos del panel.
 */
@Entity('pedidos_kits')
export class PedidoKit {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'cliente_nombre', type: 'varchar', length: 100 })
  clienteNombre: string;

  /** Correo o teléfono de quien pidió, para poder contactarlo. */
  @Column({ name: 'cliente_contacto', type: 'varchar', length: 150 })
  clienteContacto: string;

  @Column({ name: 'jabon_color', type: 'varchar', length: 60 })
  jabonColor: string;

  @Column({ name: 'jabon_aroma', type: 'varchar', length: 60 })
  jabonAroma: string;

  @Column({ name: 'jabon_forma', type: 'varchar', length: 60 })
  jabonForma: string;

  @Column({ name: 'vela_color', type: 'varchar', length: 60 })
  velaColor: string;

  @Column({ name: 'vela_aroma', type: 'varchar', length: 60 })
  velaAroma: string;

  @Column({ name: 'vela_topping', type: 'varchar', length: 60 })
  velaTopping: string;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime', precision: 6 })
  creadoEn: Date;
}
