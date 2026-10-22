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

  it('acepta TRUST_PROXY como lista o como número de saltos', () => {
    expect(validarEntorno(minimo).TRUST_PROXY).toBe('loopback');
    expect(
      validarEntorno({ ...minimo, TRUST_PROXY: 'loopback, uniquelocal' })
        .TRUST_PROXY,
    ).toBe('loopback, uniquelocal');
    expect(validarEntorno({ ...minimo, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
  });

  it('DEPLOY_HOOK_URL es opcional, pero si viene debe ser una URL', () => {
    expect(validarEntorno(minimo).DEPLOY_HOOK_URL).toBeNull();
    expect(
      validarEntorno({ ...minimo, DEPLOY_HOOK_URL: 'https://api.vercel.com/v1/integrations/deploy/prj_x/y' })
        .DEPLOY_HOOK_URL,
    ).toBe('https://api.vercel.com/v1/integrations/deploy/prj_x/y');
    expect(() => validarEntorno({ ...minimo, DEPLOY_HOOK_URL: 'no-es-url' })).toThrow(/DEPLOY_HOOK_URL/);
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
