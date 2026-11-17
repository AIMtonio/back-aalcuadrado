/** MySQL regresa DECIMAL como texto: se convierte a número al leer. */
export const decimalANumero = {
  to: (valor: number | null) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};
