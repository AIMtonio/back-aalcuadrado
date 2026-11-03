import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import type { Repository } from 'typeorm';
import { Usuario } from './usuario.entity.js';

export const PASSWORD_MIN = 8;
const COSTO_BCRYPT = 8;
/** Hash cualquiera: se compara contra él cuando el usuario no existe, para que la respuesta tarde lo mismo. */
const HASH_FALSO =
  '$2b$12$A9BPQUj4DaFZK8Y19W/HFenmllfEbgnnv0HlZqeDwyFiT7a.go07m';

/** Lo que se devuelve del usuario: nunca incluye el hash. */
export type UsuarioPublico = Omit<Usuario, 'passwordHash'>;

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly repo: Repository<Usuario>,
  ) {}

  /** Devuelve el usuario si existe, está activo y la contraseña coincide. */
  async validarCredenciales(
    usuario: string,
    password: string,
  ): Promise<UsuarioPublico | null> {
    const encontrado = await this.conHash({ usuario });
    const coincide = await bcrypt.compare(
      password,
      encontrado?.passwordHash ?? HASH_FALSO,
    );
    if (!encontrado || !encontrado.activo || !coincide) return null;
    const { passwordHash: _, ...publico } = encontrado;
    return publico;
  }

  async registrarAcceso(id: number): Promise<void> {
    await this.repo.update({ id }, { ultimoAcceso: new Date() });
  }

  async obtener(id: number): Promise<UsuarioPublico> {
    const usuario = await this.repo.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async cambiarPassword(
    id: number,
    actual: string,
    nueva: string,
  ): Promise<void> {
    const usuario = await this.conHash({ id });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (!(await bcrypt.compare(actual, usuario.passwordHash))) {
      throw new UnauthorizedException('La contraseña actual no coincide');
    }
    if (actual === nueva)
      throw new BadRequestException('La contraseña nueva debe ser distinta');
    await this.repo.update(
      { id },
      { passwordHash: await bcrypt.hash(nueva, COSTO_BCRYPT) },
    );
  }

  /** Crea el usuario o, si ya existe, le pone la contraseña nueva y lo activa. Lo usa `npm run usuario:crear`. */
  async crearOActualizar(
    usuario: string,
    password: string,
  ): Promise<'creado' | 'actualizado'> {
    if (password.length < PASSWORD_MIN) {
      throw new Error(
        `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`,
      );
    }
    if (password.length > 72)
      throw new Error('La contraseña no puede pasar de 72 caracteres');
    const passwordHash = await bcrypt.hash(password, COSTO_BCRYPT);
    const existente = await this.repo.findOne({ where: { usuario } });
    if (existente) {
      await this.repo.update(
        { id: existente.id },
        { passwordHash, activo: true },
      );
      return 'actualizado';
    }
    await this.repo.insert({ usuario, passwordHash, activo: true });
    return 'creado';
  }

  private conHash(
    where: { id: number } | { usuario: string },
  ): Promise<Usuario | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where(where)
      .getOne();
  }
}
