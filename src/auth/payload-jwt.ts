import type { Request } from 'express';

/** Lo que viaja dentro del JWT. */
export interface PayloadJwt {
  /** Id del usuario. */
  sub: number;
  usuario: string;
}

export interface RequestConUsuario extends Request {
  usuario: PayloadJwt;
}
