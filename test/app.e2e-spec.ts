import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  getDataSourceToken,
  getRepositoryToken,
  TypeOrmModule,
} from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/app.setup.js';
import { Imagen } from '../src/imagenes/imagen.entity.js';
import { Usuario } from '../src/usuarios/usuario.entity.js';
import { RepositorioMemoria } from './repositorio-memoria.js';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);

describe('API (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<NestExpressApplication['getHttpServer']>;
  let carpeta: string;
  let usuarios: RepositorioMemoria<Usuario>;
  let token: string;

  beforeAll(async () => {
    // El entorno (con una carpeta temporal para las fotos) lo pone test/entorno-e2e.ts.
    carpeta = process.env.UPLOADS_DIR!;

    usuarios = new RepositorioMemoria<Usuario>(['passwordHash']);
    usuarios.filas.push({
      id: 1,
      usuario: 'antonio',
      passwordHash: await bcrypt.hash('contrasena-de-prueba', 4),
      activo: true,
    } as Usuario);

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      // Sin MySQL: se reemplaza la conexión y los repositorios.
      .overrideModule(TypeOrmModule)
      .useModule(class SinBaseDeDatos {})
      .overrideProvider(getDataSourceToken())
      .useValue({})
      .overrideProvider(getRepositoryToken(Usuario))
      .useValue(usuarios)
      .overrideProvider(getRepositoryToken(Imagen))
      .useValue(new RepositorioMemoria())
      .compile();

    app = modulo.createNestApplication<NestExpressApplication>();
    configurarApp(app);
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app?.close();
    await rm(carpeta, { recursive: true, force: true });
  });

  it('protege todo sin token', async () => {
    await request(http).get('/api/imagenes').expect(401);
    await request(http).get('/api/usuarios/yo').expect(401);
    await request(http)
      .get('/api/imagenes')
      .set('Authorization', 'Bearer basura')
      .expect(401);
  });

  it('rechaza credenciales incorrectas', async () => {
    await request(http)
      .post('/api/auth/login')
      .send({ usuario: 'antonio', password: 'mala' })
      .expect(401);
    await request(http)
      .post('/api/auth/login')
      .send({ usuario: 'nadie', password: 'mala' })
      .expect(401);
    await request(http).post('/api/auth/login').send({}).expect(400);
  });

  it('genera un JWT con el usuario correcto', async () => {
    const res = await request(http)
      .post('/api/auth/login')
      .send({ usuario: 'antonio', password: 'contrasena-de-prueba' })
      .expect(200);
    expect(res.body).toMatchObject({ token_type: 'Bearer', expires_in: 28800 });
    token = res.body.access_token;

    const yo = await request(http)
      .get('/api/usuarios/yo')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(yo.body).toMatchObject({ id: 1, usuario: 'antonio' });
    expect(yo.body.passwordHash).toBeUndefined();
    expect(usuarios.filas[0].ultimoAcceso).toBeInstanceOf(Date);
  });

  it('sube, sirve, edita y borra una foto', async () => {
    const auth = { Authorization: `Bearer ${token}` };

    const subida = await request(http)
      .post('/api/imagenes')
      .set(auth)
      .field('categoria', 'productos')
      .field('producto', 'nochebuena')
      .field('color', '')
      .field('alt', 'Aretes Nochebuena')
      .attach('archivos', PNG, {
        filename: 'Nochebuena Roja.png',
        contentType: 'image/png',
      })
      .expect(201);
    const [imagen] = subida.body;
    expect(imagen).toMatchObject({
      categoria: 'productos',
      producto: 'nochebuena',
      color: null,
      mime: 'image/png',
    });
    expect(imagen.archivo).toMatch(/^nochebuena-roja-[0-9a-f]{8}\.png$/);
    expect(imagen.url).toBe(
      `https://api.ejemplo.com/uploads/productos/${imagen.archivo}`,
    );

    // El archivo se sirve sin token y se puede mostrar desde otro dominio.
    const archivo = await request(http)
      .get(`/uploads/productos/${imagen.archivo}`)
      .expect(200);
    expect(archivo.headers['cross-origin-resource-policy']).toBe(
      'cross-origin',
    );

    const lista = await request(http)
      .get('/api/imagenes?producto=nochebuena')
      .set(auth)
      .expect(200);
    expect(lista.body).toHaveLength(1);

    const editada = await request(http)
      .patch(`/api/imagenes/${imagen.id}`)
      .set(auth)
      .send({ categoria: 'galeria', alt: '' })
      .expect(200);
    expect(editada.body).toMatchObject({ categoria: 'galeria', alt: null });
    expect(existsSync(join(carpeta, 'galeria', imagen.archivo))).toBe(true);
    expect(existsSync(join(carpeta, 'productos', imagen.archivo))).toBe(false);

    await request(http)
      .delete(`/api/imagenes/${imagen.id}`)
      .set(auth)
      .expect(204);
    expect(existsSync(join(carpeta, 'galeria', imagen.archivo))).toBe(false);
    await request(http).get(`/api/imagenes/${imagen.id}`).set(auth).expect(404);
  });

  it('rechaza archivos que no son imagen aunque digan serlo', async () => {
    const res = await request(http)
      .post('/api/imagenes')
      .set('Authorization', `Bearer ${token}`)
      .field('categoria', 'galeria')
      .attach('archivos', Buffer.from('<?php system($_GET[1]); ?>'), {
        filename: 'foto.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
    expect(res.body.message).toMatch(/no es una imagen/);
  });

  it('valida los campos y la categoría', async () => {
    await request(http)
      .post('/api/imagenes')
      .set('Authorization', `Bearer ${token}`)
      .field('categoria', '../../etc')
      .attach('archivos', PNG, 'a.png')
      .expect(400);
    await request(http)
      .post('/api/imagenes')
      .set('Authorization', `Bearer ${token}`)
      .field('categoria', 'galeria')
      .field('campoRaro', 'x')
      .attach('archivos', PNG, 'a.png')
      .expect(400);
  });

  it('sirve el panel', async () => {
    const res = await request(http).get('/panel/').expect(200);
    expect(res.text).toContain('Panel aalcuadrado');
  });
});
