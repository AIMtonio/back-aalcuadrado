import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { MODULOS_DE_NEGOCIO } from '../src/app.module.js';
import { configurarApp } from '../src/app.setup.js';
import { validarEntorno } from '../src/config/entorno.js';
import { Producto } from '../src/productos/producto.entity.js';
import { Usuario } from '../src/usuarios/usuario.entity.js';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);

describe('API (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<NestExpressApplication['getHttpServer']>;
  let carpeta: string;
  let db: DataSource;
  let token: string;

  beforeAll(async () => {
    // El entorno (con una carpeta temporal para las fotos) lo pone test/entorno-e2e.ts.
    carpeta = process.env.UPLOADS_DIR!;

    // Los mismos módulos que AppModule, pero sobre SQLite en memoria en lugar de MySQL.
    const modulo = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno }),
        ThrottlerModule.forRoot([
          { name: 'default', ttl: 60_000, limit: 1000 },
        ]),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          autoLoadEntities: true,
          synchronize: true,
        }),
        ...MODULOS_DE_NEGOCIO,
      ],
    }).compile();

    db = modulo.get<DataSource>(getDataSourceToken());
    await db.getRepository(Usuario).insert({
      usuario: 'antonio',
      passwordHash: await bcrypt.hash('contrasena-de-prueba', 4),
      activo: true,
    });
    await db.getRepository(Producto).save({
      slug: 'nochebuena',
      nombre: 'Nochebuena',
      coleccion: 'navidad',
      colores: [{ colorId: 'rojo', nombre: 'Rojo', hex: '#C8102E', orden: 0 }],
    });

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
    const fila = await db.getRepository(Usuario).findOneBy({ id: 1 });
    expect(fila?.ultimoAcceso).toBeInstanceOf(Date);
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

  it('exige producto en las fotos de productos y lo limpia en la galería', async () => {
    const auth = { Authorization: `Bearer ${token}` };

    const sinProducto = await request(http)
      .post('/api/imagenes')
      .set(auth)
      .field('categoria', 'productos')
      .field('producto', '')
      .attach('archivos', PNG, 'a.png')
      .expect(400);
    expect(sinProducto.body.message).toMatch(/Elige el producto/);

    const [enGaleria] = (
      await request(http)
        .post('/api/imagenes')
        .set(auth)
        .field('categoria', 'galeria')
        .field('producto', 'nochebuena')
        .field('color', 'rojo')
        .attach('archivos', PNG, 'a.png')
        .expect(201)
    ).body;
    expect(enGaleria).toMatchObject({ producto: null, color: null });

    // Pasarla a productos sin decir de cuál producto no se permite.
    await request(http)
      .patch(`/api/imagenes/${enGaleria.id}`)
      .set(auth)
      .send({ categoria: 'productos' })
      .expect(400);
    const movida = await request(http)
      .patch(`/api/imagenes/${enGaleria.id}`)
      .set(auth)
      .send({ categoria: 'productos', producto: 'nochebuena', color: 'rojo' })
      .expect(200);
    expect(movida.body).toMatchObject({
      categoria: 'productos',
      producto: 'nochebuena',
      color: 'rojo',
    });

    // Quitarle el producto tampoco.
    await request(http)
      .patch(`/api/imagenes/${enGaleria.id}`)
      .set(auth)
      .send({ producto: '' })
      .expect(400);
  });

  it('no acepta una URL como texto alternativo', async () => {
    const res = await request(http)
      .post('/api/imagenes')
      .set('Authorization', `Bearer ${token}`)
      .field('categoria', 'galeria')
      .field('alt', 'http://localhost:3000/uploads/galeria/a.png')
      .attach('archivos', PNG, 'a.png')
      .expect(400);
    expect(res.body.message.join(' ')).toMatch(/no pongas una URL/);
  });

  it('solo acepta productos y colores que existen', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const sinProducto = await request(http)
      .post('/api/imagenes')
      .set(auth)
      .field('categoria', 'productos')
      .field('producto', 'no-existe')
      .attach('archivos', PNG, 'a.png')
      .expect(400);
    expect(sinProducto.body.message).toMatch(
      /No existe el producto "no-existe"/,
    );

    const sinColor = await request(http)
      .post('/api/imagenes')
      .set(auth)
      .field('categoria', 'productos')
      .field('producto', 'nochebuena')
      .field('color', 'verde')
      .attach('archivos', PNG, 'a.png')
      .expect(400);
    expect(sinColor.body.message).toMatch(/no tiene el color "verde"/);
  });

  it('crea, lista, edita y borra productos', async () => {
    const auth = { Authorization: `Bearer ${token}` };

    const creado = await request(http)
      .post('/api/productos')
      .set(auth)
      .send({
        nombre: 'Corazón de talavera',
        coleccion: 'mexicanos',
        descripcion: 'El trazo de la talavera poblana.',
        etiqueta: 'Nuevo',
        precio: 150,
        colores: [
          { nombre: 'Azul cobalto', hex: '#1f3fae' },
          { nombre: 'Amarillo', hex: '#F2B705' },
        ],
      })
      .expect(201);
    expect(creado.body).toMatchObject({
      slug: 'corazon-de-talavera',
      coleccion: 'mexicanos',
      etiqueta: 'Nuevo',
      precio: 150,
      disponible: true,
      destacado: false,
      orden: null,
      totalFotos: 0,
      colores: [
        { id: 'azul-cobalto', nombre: 'Azul cobalto', hex: '#1F3FAE' },
        { id: 'amarillo', nombre: 'Amarillo', hex: '#F2B705' },
      ],
    });

    // Slug repetido: 409.
    await request(http)
      .post('/api/productos')
      .set(auth)
      .send({ nombre: 'Corazón de talavera', coleccion: 'mexicanos' })
      .expect(409);
    // Colección que no existe y colores repetidos: 400.
    await request(http)
      .post('/api/productos')
      .set(auth)
      .send({ nombre: 'X', coleccion: 'halloween' })
      .expect(400);
    await request(http)
      .post('/api/productos')
      .set(auth)
      .send({
        nombre: 'Y',
        coleccion: 'otros',
        colores: [
          { nombre: 'Rojo', hex: '#f00' },
          { nombre: 'rojo', hex: '#f00' },
        ],
      })
      .expect(400);

    // Una foto en amarillo; luego se quita el amarillo: la foto se queda sin color.
    const [foto] = (
      await request(http)
        .post('/api/imagenes')
        .set(auth)
        .field('categoria', 'productos')
        .field('producto', 'corazon-de-talavera')
        .field('color', 'amarillo')
        .attach('archivos', PNG, 'a.png')
        .expect(201)
    ).body;

    const editado = await request(http)
      .patch('/api/productos/corazon-de-talavera')
      .set(auth)
      .send({
        disponible: false,
        etiqueta: '',
        colores: [
          { id: 'azul-cobalto', nombre: 'Azul cobalto', hex: '#1F3FAE' },
        ],
      })
      .expect(200);
    expect(editado.body).toMatchObject({
      disponible: false,
      etiqueta: null,
      totalFotos: 1,
      colores: [{ id: 'azul-cobalto' }],
    });
    const fotoDespues = await request(http)
      .get(`/api/imagenes/${foto.id}`)
      .set(auth)
      .expect(200);
    expect(fotoDespues.body.color).toBeNull();

    const lista = await request(http)
      .get('/api/productos')
      .set(auth)
      .expect(200);
    expect(lista.body.map((p: { slug: string }) => p.slug)).toEqual([
      'corazon-de-talavera',
      'nochebuena',
    ]);

    // Con fotos no se puede borrar; sin fotos, sí.
    const conflicto = await request(http)
      .delete('/api/productos/corazon-de-talavera')
      .set(auth)
      .expect(409);
    expect(conflicto.body.message).toMatch(/tiene 1 foto/);
    await request(http)
      .delete(`/api/imagenes/${foto.id}`)
      .set(auth)
      .expect(204);
    await request(http)
      .delete('/api/productos/corazon-de-talavera')
      .set(auth)
      .expect(204);
    await request(http)
      .get('/api/productos/corazon-de-talavera')
      .set(auth)
      .expect(404);
  });

  it('sirve el panel', async () => {
    const res = await request(http).get('/panel/').expect(200);
    expect(res.text).toContain('Panel aalcuadrado');
  });
});
