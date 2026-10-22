/**
 * Categorías de fotos. Son las mismas carpetas que usa el front
 * (src/content/fotos/productos y src/content/fotos/galeria).
 * Cada una es una subcarpeta dentro de UPLOADS_DIR.
 */
export const CATEGORIAS = ['productos', 'galeria'] as const;
export type Categoria = (typeof CATEGORIAS)[number];
