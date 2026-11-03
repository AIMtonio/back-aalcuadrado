import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'esPublico';

/** Marca una ruta como pública: el guard de JWT la deja pasar sin token. */
export const Publico = () => SetMetadata(ES_PUBLICO, true);
