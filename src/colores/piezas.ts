/**
 * Las piezas que llevan color. Cada una tiene su propia lista de colores:
 * los del jabón salen en el jabón del kit; los de vela, en la vela del kit
 * y en las velas individuales.
 */
export const PIEZAS = ['jabon', 'vela'] as const;
export type Pieza = (typeof PIEZAS)[number];

/** Cómo se llama cada pieza en los mensajes y en el panel. */
export const NOMBRES_PIEZA: Record<Pieza, string> = {
  jabon: 'jabón',
  vela: 'vela',
};
