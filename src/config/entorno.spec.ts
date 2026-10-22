import { validarEntorno } from './entorno.js';

const minimo = {
  DB_USER: 'u',
  DB_PASSWORD: 'p',
  DB_NAME: 'aalcuadrado',
  JWT_SECRET: 'x'.repeat(32),
  UPLOADS_DIR: '/tmp/fotos',
  PUBLIC_URL: 'https://api.ejemplo.com/',
};

describe('validarEntorno', () => {
  it('aplica valores por defecto y limpia la URL pública', () => {
    const entorno = validarEntorno({
      ...minimo,
      CORS_ORIGINS: 'https://a.com, https://b.com',
    });
    expect(entorno.PORT).toBe(3000);
    expect(entorno.HOST).toBe('127.0.0.1');
    expect(entorno.PUBLIC_URL).toBe('https://api.ejemplo.com');
    expect(entorno.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it('dice qué variables faltan', () => {
    expect(() => validarEntorno({})).toThrow(/DB_USER.*JWT_SECRET/);
  });

  it('exige un JWT_SECRET largo', () => {
    expect(() => validarEntorno({ ...minimo, JWT_SECRET: 'corto' })).toThrow(
      /32/,
    );
  });
});
