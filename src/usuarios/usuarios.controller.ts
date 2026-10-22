import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import type { PayloadJwt } from '../auth/payload-jwt.js';
import { UsuarioActual } from '../auth/usuario-actual.decorator.js';
import { CambiarPasswordDto } from './dto/cambiar-password.dto.js';
import { UsuariosService } from './usuarios.service.js';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get('yo')
  yo(@UsuarioActual() usuario: PayloadJwt) {
    return this.usuarios.obtener(usuario.sub);
  }

  @Patch('yo/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  cambiarPassword(
    @UsuarioActual() usuario: PayloadJwt,
    @Body() dto: CambiarPasswordDto,
  ) {
    return this.usuarios.cambiarPassword(
      usuario.sub,
      dto.passwordActual,
      dto.passwordNueva,
    );
  }
}
