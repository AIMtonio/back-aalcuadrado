/**
 * Categorías de fotos. Son las mismas carpetas que usa el front
 * (src/content/fotos/productos, src/content/fotos/galeria…). "kits" son las
 * fotos de kits de jabón y vela que salen en la página de kits; las
 * "velas-*" muestran cómo se ve cada tipo de vela individual.
 * Cada una es una subcarpeta dentro de UPLOADS_DIR.
 */
export const CATEGORIAS = [
  'productos',
  'galeria',
  'kits',
  'velas-recipiente',
  'velas-molde',
  'velas-jicara',
] as const;
export type Categoria = (typeof CATEGORIAS)[number];
