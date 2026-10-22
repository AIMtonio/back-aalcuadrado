import { detectarTipoImagen, nombreSeguro } from './tipo-imagen.js';

describe('detectarTipoImagen', () => {
  it('reconoce JPG, PNG, WebP y AVIF por sus bytes', () => {
    expect(detectarTipoImagen(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    );
    expect(
      detectarTipoImagen(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
      ),
    ).toBe('image/png');
    expect(
      detectarTipoImagen(Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'latin1')),
    ).toBe('image/webp');
    expect(
      detectarTipoImagen(Buffer.from('\x00\x00\x00\x1cftypavif', 'latin1')),
    ).toBe('image/avif');
  });

  it('rechaza lo que no es imagen aunque se llame .jpg', () => {
    expect(detectarTipoImagen(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(
      detectarTipoImagen(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      ),
    ).toBeNull();
    expect(detectarTipoImagen(Buffer.alloc(0))).toBeNull();
  });
});

describe('nombreSeguro', () => {
  it('quita acentos, espacios, extensión y rutas', () => {
    expect(nombreSeguro('Aretes en Caja (1).JPG')).toBe('aretes-en-caja-1');
    expect(nombreSeguro('Corazón Talavera.png')).toBe('corazon-talavera');
    expect(nombreSeguro('fotos/../../etc/passwd.jpg')).toBe('fotos-etc-passwd');
    expect(nombreSeguro('.jpg')).toBe('foto');
  });
});
