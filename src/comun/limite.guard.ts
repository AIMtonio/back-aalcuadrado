import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { ipDelVisitante } from './ip-visitante.js';

/** El límite de peticiones de siempre, pero contado por la IP real del visitante. */
@Injectable()
export class LimiteGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(ipDelVisitante(req as unknown as Request));
  }
}
