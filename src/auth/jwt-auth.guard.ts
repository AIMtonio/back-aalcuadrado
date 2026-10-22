import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ES_PUBLICO } from './publico.decorator.js';
import type { PayloadJwt, RequestConUsuario } from './payload-jwt.js';

/**
 * Guard global: toda ruta exige `Authorization: Bearer <token>`,
 * salvo las marcadas con `@Publico()`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (esPublico) return true;

    const req = ctx.switchToHttp().getRequest<RequestConUsuario>();
    const [tipo, token] = req.headers.authorization?.split(' ') ?? [];
    if (tipo !== 'Bearer' || !token)
      throw new UnauthorizedException('Falta el token');

    try {
      req.usuario = await this.jwt.verifyAsync<PayloadJwt>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }
    return true;
  }
}
