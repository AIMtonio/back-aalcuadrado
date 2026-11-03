import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Tabla `usuarios`. Debe coincidir con database/01_crear_base_de_datos.sql. */
@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  usuario: string;

  /** Hash bcrypt. No se lee salvo que se pida explícitamente. */
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 100,
    select: false,
  })
  passwordHash: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'ultimo_acceso', type: 'datetime', nullable: true })
  ultimoAcceso: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime', precision: 6 })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime', precision: 6 })
  actualizadoEn: Date;
}
