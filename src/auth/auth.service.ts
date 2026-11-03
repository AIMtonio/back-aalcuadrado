import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Entorno } from '../config/entorno.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import type { PayloadJwt } from './payload-jwt.js';

export interface TokenRespuesta {
  access_token: string;
  token_type: 'Bearer';
  /** Segundos que dura el token. */
  expires_in: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Entorno, true>,
  ) {}

  async login(usuario: string, password: string): Promise<TokenRespuesta> {
    const encontrado = await this.usuarios.validarCredenciales(
      usuario,
      password,
    );
    if (!encontrado)
      throw new UnauthorizedException('Usuario o contraseña incorrectos');

    await this.usuarios.registrarAcceso(encontrado.id);
    const payload: PayloadJwt = {
      sub: encontrado.id,
      usuario: encontrado.usuario,
    };
    return {
      access_token: await this.jwt.signAsync(payload),
      token_type: 'Bearer',
      expires_in: this.config.get('JWT_EXPIRA_SEGUNDOS', { infer: true }),
    };
  }
}
