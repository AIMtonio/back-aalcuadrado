/**
 * Crea el usuario del panel (o le cambia la contraseña si ya existe).
 *
 *   npm run build
 *   npm run usuario:crear -- antonio
 *
 * Pide la contraseña sin mostrarla. Usa la misma conexión del .env que la API.
 */
import { createInterface } from 'node:readline';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';

function preguntarOculto(pregunta: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    let mostrandoPregunta = true;
    // Escribe la pregunta pero no lo que se teclea después.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput =
      (s: string) => {
        if (mostrandoPregunta) process.stdout.write(s);
      };
    rl.question(pregunta, (respuesta) => {
      rl.close();
      process.stdout.write('\n');
      resolve(respuesta);
    });
    mostrandoPregunta = false;
  });
}

async function main() {
  const usuario = process.argv[2]?.trim();
  if (!usuario || !/^[a-zA-Z0-9._-]{3,50}$/.test(usuario)) {
    console.error(
      'Uso: npm run usuario:crear -- <usuario>   (3 a 50 letras, números, ".", "_" o "-")',
    );
    process.exit(1);
  }

  const password =
    process.env.PASSWORD_NUEVA ??
    (await preguntarOculto(`Contraseña para "${usuario}": `));
  if (
    !process.env.PASSWORD_NUEVA &&
    (await preguntarOculto('Repítela: ')) !== password
  ) {
    console.error('Las contraseñas no coinciden.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const resultado = await app
      .get(UsuariosService)
      .crearOActualizar(usuario, password);
    Logger.log(`Usuario "${usuario}" ${resultado}.`, 'usuario:crear');
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

await main();
