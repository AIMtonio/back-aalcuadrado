/**
 * Valores fijos del catálogo. Son los mismos que usa el front
 * (src/domain/colecciones.ts y ETIQUETAS en src/domain/catalogo.ts):
 * si cambian allá, deben cambiar aquí y en database/01_crear_base_de_datos.sql.
 */
export const COLECCIONES = [
  'dia-de-muertos',
  'mexicanos',
  'patrios',
  'navidad',
  'otros',
] as const;
export type Coleccion = (typeof COLECCIONES)[number];

export const ETIQUETAS = ['Nuevo', 'Temporada', 'Más vendido'] as const;
export type Etiqueta = (typeof ETIQUETAS)[number];

/** Minúsculas, números y guiones: el formato de los slugs de producto y de los ids de color. */
export const REGEX_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MENSAJE_SLUG =
  'Usa minúsculas, números y guiones, sin espacios ni acentos';

/** "Rosa mexicano" → `rosa-mexicano`. Igual que `slugificar` del front. */
export function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
