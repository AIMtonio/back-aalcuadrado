// Variables para las pruebas e2e. Se cargan antes de importar AppModule,
// porque ConfigModule valida el entorno en cuanto se importa.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_USER: 'x',
  DB_PASSWORD: 'x',
  DB_NAME: 'x',
  JWT_SECRET: 'secreto-de-pruebas-con-mas-de-32-caracteres',
  UPLOADS_DIR: mkdtempSync(join(tmpdir(), 'aalcuadrado-')),
  PUBLIC_URL: 'https://api.ejemplo.com',
});
