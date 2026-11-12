/**
 * Los tres tipos de vela individual. Cada uno tiene sus presentaciones
 * (tamaños o moldes) en la tabla `velas_presentaciones` y su propia
 * categoría de fotos (`velas-<tipo>`) para mostrar cómo se ven.
 */
export const TIPOS_VELA = ['recipiente', 'molde', 'jicara'] as const;
export type TipoVela = (typeof TIPOS_VELA)[number];

/** Cómo se llama cada tipo en los mensajes y en el panel. */
export const NOMBRES_TIPO_VELA: Record<TipoVela, string> = {
  recipiente: 'En recipiente',
  molde: 'De molde',
  jicara: 'En jícara',
};

/** En jícara el marmoleado no se aprecia: nunca se ofrece. */
export function admiteMarmoleado(tipo: TipoVela): boolean {
  return tipo !== 'jicara';
}
