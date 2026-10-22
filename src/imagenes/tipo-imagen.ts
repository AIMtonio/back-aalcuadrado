/** Formatos aceptados, con la extensión con la que se guardan. */
export const FORMATOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
} as const;
export type MimeImagen = keyof typeof FORMATOS;

const ascii = (buf: Buffer, inicio: number, fin: number) =>
  buf.subarray(inicio, fin).toString('latin1');

/**
 * Reconoce el formato por los primeros bytes del archivo (no por la extensión
 * ni por el Content-Type, que los manda el cliente y se pueden falsear).
 */
export function detectarTipoImagen(buf: Buffer): MimeImagen | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    ascii(buf, 0, 4) === 'RIFF' &&
    ascii(buf, 8, 12) === 'WEBP'
  )
    return 'image/webp';
  if (
    buf.length >= 12 &&
    ascii(buf, 4, 8) === 'ftyp' &&
    ['avif', 'avis'].includes(ascii(buf, 8, 12))
  ) {
    return 'image/avif';
  }
  return null;
}

/** "Aretes en Caja (1).JPG" → "aretes-en-caja-1". Se usa para el nombre del archivo en disco. */
export function nombreSeguro(original: string): string {
  const base = original
    .replace(/\.[^.]*$/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'foto';
}
