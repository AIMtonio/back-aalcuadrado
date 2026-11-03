import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PayloadJwt, RequestConUsuario } from './payload-jwt.js';

/** Inyecta en el controlador el usuario que viene en el JWT. */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): PayloadJwt =>
    ctx.switchToHttp().getRequest<RequestConUsuario>().usuario,
);
