/**
 * Variables de entorno que necesita la API.
 * Se validan al arrancar: si falta algo, la app no levanta y dice qué falta.
 */
export interface Entorno {
  NODE_ENV: 'development' | 'production' | 'test';
  HOST: string;
  PORT: number;
  /** URL pública de la API (la del túnel), sin `/` al final. Se usa para armar la URL de cada foto. */
  PUBLIC_URL: string;
  /** Orígenes que pueden llamar a la API desde un navegador, separados por comas. */
  CORS_ORIGINS: string[];

  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;

  JWT_SECRET: string;
  JWT_EXPIRA_SEGUNDOS: number;

  /** Carpeta donde se guardan las fotos. Dentro se crea una subcarpeta por categoría. */
  UPLOADS_DIR: string;
  /** Tamaño máximo por foto, en megabytes. */
  UPLOADS_MAX_MB: number;
}

const REQUERIDAS = [
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'UPLOADS_DIR',
  'PUBLIC_URL',
] as const;

function entero(valor: unknown, nombre: string, porDefecto: number): number {
  if (valor === undefined || valor === '') return porDefecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0)
    throw new Error(`${nombre} debe ser un entero positivo`);
  return n;
}

export function validarEntorno(crudo: Record<string, unknown>): Entorno {
  const faltan = REQUERIDAS.filter((k) => !crudo[k]);
  if (faltan.length > 0)
    throw new Error(`Faltan variables de entorno: ${faltan.join(', ')}`);

  const jwtSecret = String(crudo.JWT_SECRET);
  if (jwtSecret.length < 32)
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres');

  const nodeEnv = String(crudo.NODE_ENV ?? 'development');
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error('NODE_ENV debe ser development, production o test');
  }

  return {
    NODE_ENV: nodeEnv as Entorno['NODE_ENV'],
    HOST: String(crudo.HOST ?? '127.0.0.1'),
    PORT: entero(crudo.PORT, 'PORT', 3000),
    PUBLIC_URL: String(crudo.PUBLIC_URL).replace(/\/+$/, ''),
    CORS_ORIGINS: String(crudo.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    DB_HOST: String(crudo.DB_HOST ?? '127.0.0.1'),
    DB_PORT: entero(crudo.DB_PORT, 'DB_PORT', 3306),
    DB_USER: String(crudo.DB_USER),
    DB_PASSWORD: String(crudo.DB_PASSWORD),
    DB_NAME: String(crudo.DB_NAME),
    JWT_SECRET: jwtSecret,
    JWT_EXPIRA_SEGUNDOS: entero(
      crudo.JWT_EXPIRA_SEGUNDOS,
      'JWT_EXPIRA_SEGUNDOS',
      8 * 60 * 60,
    ),
    UPLOADS_DIR: String(crudo.UPLOADS_DIR),
    UPLOADS_MAX_MB: entero(crudo.UPLOADS_MAX_MB, 'UPLOADS_MAX_MB', 10),
  };
}
