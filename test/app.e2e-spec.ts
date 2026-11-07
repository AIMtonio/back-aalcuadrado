import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
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
  // Imita el Deploy Hook de Vercel: cuenta los POST y responde con `estadoHook`.
  let hook: Server;
  let llamadasHook = 0;
  let estadoHook = 201;
  // Imita la API de imágenes de OpenAI: guarda la última petición y responde con `respuestaOpenAi`.
  let openAi: Server;
  let pedidoOpenAi: { auth?: string; cuerpo?: Record<string, unknown> } = {};
  let respuestaOpenAi: { estado: number; cuerpo: unknown } = {
    estado: 200,
    cuerpo: { data: [{ b64_json: 'aW1hZ2Vu' }] },
  };

  beforeAll(async () => {
    // El entorno (con una carpeta temporal para las fotos) lo pone test/entorno-e2e.ts.
    carpeta = process.env.UPLOADS_DIR!;

    hook = createServer((req, res) => {
      if (req.method === 'POST') llamadasHook++;
      res.writeHead(estadoHook, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ job: { id: 'dpl_prueba', state: 'PENDING' } }));
    });
    await new Promise<void>((listo) => hook.listen(0, '127.0.0.1', listo));
    process.env.DEPLOY_HOOK_URL = `http://127.0.0.1:${(hook.address() as AddressInfo).port}/hook`;

    openAi = createServer((req, res) => {
      let datos = '';
      req.on('data', (parte: Buffer) => (datos += parte.toString()));
      req.on('end', () => {
        pedidoOpenAi = {
          auth: req.headers.authorization,
          cuerpo: JSON.parse(datos) as Record<string, unknown>,
        };
        res.writeHead(respuestaOpenAi.estado, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify(respuestaOpenAi.cuerpo));
      });
    });
    await new Promise<void>((listo) => openAi.listen(0, '127.0.0.1', listo));
    Object.assign(process.env, {
      OPENAI_API_KEY: 'sk-prueba',
      OPENAI_BASE_URL: `http://127.0.0.1:${(openAi.address() as AddressInfo).port}/v1`,
      OPENAI_MAX_IMAGENES_DIA: '3',
      OPENAI_MAX_IMAGENES_VISITANTE: '1',
    });

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
    hook?.close();
    openAi?.close();
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

  it('crea, lista y edita categorías, y las asigna a productos', async () => {
    const auth = { Authorization: `Bearer ${token}` };

    const creada = await request(http)
      .post('/api/categorias')
      .set(auth)
      .send({ nombre: 'Arracadas' })
      .expect(201);
    expect(creada.body).toMatchObject({
      slug: 'arracadas',
      nombre: 'Arracadas',
      orden: 0,
      totalProductos: 0,
    });

    // Slug repetido: 409.
    await request(http)
      .post('/api/categorias')
      .set(auth)
      .send({ nombre: 'Arracadas' })
      .expect(409);

    const editada = await request(http)
      .patch('/api/categorias/arracadas')
      .set(auth)
      .send({ orden: 5 })
      .expect(200);
    expect(editada.body.orden).toBe(5);

    // Asignarla a un producto: aparece anidada en /api/productos.
    const producto = await request(http)
      .patch('/api/productos/nochebuena')
      .set(auth)
      .send({ categoriaId: creada.body.id })
      .expect(200);
    expect(producto.body.categoria).toMatchObject({
      slug: 'arracadas',
      nombre: 'Arracadas',
    });

    // Categoría que no existe: 400.
    await request(http)
      .patch('/api/productos/nochebuena')
      .set(auth)
      .send({ categoriaId: 999 })
      .expect(400);

    const lista = await request(http)
      .get('/api/categorias')
      .set(auth)
      .expect(200);
    expect(lista.body).toEqual([
      expect.objectContaining({ slug: 'arracadas', totalProductos: 1 }),
    ]);

    // No se borra una categoría con productos asignados.
    const conflicto = await request(http)
      .delete('/api/categorias/arracadas')
      .set(auth)
      .expect(409);
    expect(conflicto.body.message).toMatch(/tiene 1 producto/);

    // Se le quita la categoría al producto y ya se puede borrar.
    await request(http)
      .patch('/api/productos/nochebuena')
      .set(auth)
      .send({ categoriaId: null })
      .expect(200);
    await request(http)
      .delete('/api/categorias/arracadas')
      .set(auth)
      .expect(204);
    await request(http).get('/api/categorias/arracadas').set(auth).expect(404);
  });

  it('crea pedidos de kits sin token, y solo el panel los lista y los borra', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const datosPedido = {
      clienteNombre: 'Ana',
      clienteContacto: 'ana@correo.com',
      jabonColor: 'Lavanda',
      jabonAroma: 'Lavanda',
      jabonForma: 'Corazón',
      velaColor: 'Blanco',
      velaAroma: 'Vainilla',
      velaTopping: 'Flores secas',
    };

    // Pública: no pide token.
    const creado = await request(http)
      .post('/api/pedidos')
      .send(datosPedido)
      .expect(201);
    expect(creado.body).toMatchObject(datosPedido);
    expect(creado.body.creadoEn).toBeTruthy();

    // Contacto que no es correo ni teléfono: 400.
    await request(http)
      .post('/api/pedidos')
      .send({ ...datosPedido, clienteContacto: 'no-es-contacto' })
      .expect(400);

    // Un teléfono también sirve como contacto.
    await request(http)
      .post('/api/pedidos')
      .send({ ...datosPedido, clienteContacto: '+52 55 1234 5678' })
      .expect(201);

    // Listar y borrar sí piden token.
    await request(http).get('/api/pedidos').expect(401);
    const lista = await request(http).get('/api/pedidos').set(auth).expect(200);
    expect(lista.body).toHaveLength(2);

    await request(http)
      .delete(`/api/pedidos/${lista.body[0].id}`)
      .set(auth)
      .expect(204);
    await request(http).delete('/api/pedidos/999999').set(auth).expect(404);
  });

  it('publica el sitio llamando al Deploy Hook', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(http).post('/api/publicacion').expect(401);

    const antes = await request(http)
      .get('/api/publicacion')
      .set(auth)
      .expect(200);
    expect(antes.body).toEqual({ configurada: true, ultima: null });

    const res = await request(http)
      .post('/api/publicacion')
      .set(auth)
      .expect(202);
    expect(res.body).toMatchObject({ build: 'dpl_prueba' });
    expect(llamadasHook).toBe(1);

    const despues = await request(http)
      .get('/api/publicacion')
      .set(auth)
      .expect(200);
    expect(despues.body.ultima).toEqual(res.body);

    // Si el proveedor falla, la API responde 502 con un mensaje claro.
    estadoHook = 404;
    const falla = await request(http)
      .post('/api/publicacion')
      .set(auth)
      .expect(502);
    expect(falla.body.message).toMatch(/respondió 404/);
  });

  it('genera el diseño de unos aretes con OpenAI, sin token', async () => {
    const inicio = await request(http).get('/api/disenos').expect(200);
    expect(inicio.body).toEqual({ disponible: true, restantesHoy: 3 });

    await request(http).post('/api/disenos').send({ texto: ' ' }).expect(400);

    // Si OpenAI rechaza la idea, se explica y no se gasta el cupo.
    respuestaOpenAi = {
      estado: 400,
      cuerpo: { error: { code: 'moderation_blocked', message: 'no' } },
    };
    await request(http)
      .post('/api/disenos')
      .send({ texto: 'algo que no se puede' })
      .expect(422);

    respuestaOpenAi = {
      estado: 200,
      cuerpo: { data: [{ b64_json: 'aW1hZ2Vu' }] },
    };
    const res = await request(http)
      .post('/api/disenos')
      .send({ texto: 'Calaveritas con flores "rosas"' })
      .expect(200);
    expect(res.body).toEqual({
      imagen: 'data:image/webp;base64,aW1hZ2Vu',
      restantesHoy: 2,
    });
    expect(pedidoOpenAi.auth).toBe('Bearer sk-prueba');
    expect(pedidoOpenAi.cuerpo).toMatchObject({
      model: 'gpt-image-2',
      quality: 'medium',
      output_format: 'webp',
    });
    const prompt = String(pedidoOpenAi.cuerpo?.prompt);
    expect(prompt).toMatch(/^Actúa como un diseñador 3D/);
    expect(prompt).toContain('Fondo gris claro');
    expect(prompt).toMatch(
      /Idea del cliente: "Calaveritas con flores 'rosas'"$/,
    );

    // Solo cuentan los diseños que salieron bien: el 400 y el 422 no gastaron su cupo,
    // pero el que salió bien sí (OPENAI_MAX_IMAGENES_VISITANTE=1).
    const otraVez = await request(http)
      .post('/api/disenos')
      .send({ texto: 'otra idea' })
      .expect(429);
    expect(otraVez.body.message).toMatch(
      /^Ya creaste 1 diseño en la última hora/,
    );

    // Detrás del túnel, cada visitante se distingue por CF-Connecting-IP.
    for (const [ip, restantes] of [
      ['203.0.113.1', 1],
      ['203.0.113.2', 0],
    ] as const) {
      const otro = await request(http)
        .post('/api/disenos')
        .set('CF-Connecting-IP', ip)
        .send({ texto: 'flores de cempasúchil' })
        .expect(200);
      expect(otro.body.restantesHoy).toBe(restantes);
    }

    // Se acabó el cupo del día.
    const fin = await request(http).get('/api/disenos').expect(200);
    expect(fin.body).toEqual({ disponible: false, restantesHoy: 0 });
  });

  it('administra los colores y aromas de los kits', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(http).get('/api/kits/colores').expect(401);

    const rojo = await request(http)
      .post('/api/kits/colores')
      .set(auth)
      .send({ nombre: '  Rojo   navidad ', hex: '#b3202a', enVela: false })
      .expect(201);
    expect(rojo.body).toMatchObject({
      nombre: 'Rojo navidad',
      hex: '#B3202A',
      enJabon: true,
      enVela: false,
      disponible: true,
      orden: 0,
    });

    // Validaciones: hex, nombre repetido (sin importar mayúsculas) y al menos una pieza.
    await request(http)
      .post('/api/kits/colores')
      .set(auth)
      .send({ nombre: 'Verde', hex: 'verde' })
      .expect(400);
    await request(http)
      .post('/api/kits/colores')
      .set(auth)
      .send({ nombre: 'ROJO NAVIDAD', hex: '#000000' })
      .expect(409);
    const sinPieza = await request(http)
      .post('/api/kits/colores')
      .set(auth)
      .send({ nombre: 'Gris', hex: '#888888', enJabon: false, enVela: false })
      .expect(400);
    expect(sinPieza.body.message).toMatch(/jabón, para la vela o para ambos/);

    await request(http)
      .post('/api/kits/colores')
      .set(auth)
      .send({ nombre: 'Dorado', hex: '#C9A227', orden: -1 })
      .expect(201);
    const lista = await request(http)
      .get('/api/kits/colores')
      .set(auth)
      .expect(200);
    expect(lista.body.map((c: { nombre: string }) => c.nombre)).toEqual([
      'Dorado',
      'Rojo navidad',
    ]);

    const editado = await request(http)
      .patch(`/api/kits/colores/${rojo.body.id}`)
      .set(auth)
      .send({ disponible: false, enVela: true })
      .expect(200);
    expect(editado.body).toMatchObject({ disponible: false, enVela: true });
    await request(http)
      .patch(`/api/kits/colores/${rojo.body.id}`)
      .set(auth)
      .send({ enJabon: false, enVela: false })
      .expect(400);
    await request(http)
      .patch(`/api/kits/colores/${rojo.body.id}`)
      .set(auth)
      .send({ nombre: 'dorado' })
      .expect(409);

    await request(http)
      .delete(`/api/kits/colores/${rojo.body.id}`)
      .set(auth)
      .expect(204);
    await request(http)
      .delete(`/api/kits/colores/${rojo.body.id}`)
      .set(auth)
      .expect(404);

    // Los aromas funcionan igual, sin hex.
    const canela = await request(http)
      .post('/api/kits/aromas')
      .set(auth)
      .send({ nombre: 'Canela', enJabon: false })
      .expect(201);
    expect(canela.body).toMatchObject({ nombre: 'Canela', enVela: true });
    expect(canela.body.hex).toBeUndefined();
    await request(http)
      .patch(`/api/kits/aromas/${canela.body.id}`)
      .set(auth)
      .send({ nombre: 'Canela y clavo', orden: 3 })
      .expect(200);
    const aromas = await request(http)
      .get('/api/kits/aromas')
      .set(auth)
      .expect(200);
    expect(aromas.body).toHaveLength(1);
    expect(aromas.body[0]).toMatchObject({
      nombre: 'Canela y clavo',
      orden: 3,
    });
  });

  it('guarda las fotos de kits sin producto, en su carpeta', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const res = await request(http)
      .post('/api/imagenes')
      .set(auth)
      .field('categoria', 'kits')
      .field('producto', 'nochebuena')
      .attach('archivos', PNG, {
        filename: 'kit-rojo.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(res.body[0]).toMatchObject({
      categoria: 'kits',
      producto: null,
      color: null,
    });
    expect(res.body[0].url).toMatch(/\/uploads\/kits\//);
    expect(existsSync(join(carpeta, 'kits', res.body[0].archivo))).toBe(true);

    const kits = await request(http)
      .get('/api/imagenes?categoria=kits')
      .set(auth)
      .expect(200);
    expect(kits.body).toHaveLength(1);
  });

  it('sirve el panel', async () => {
    const res = await request(http).get('/panel/').expect(200);
    expect(res.text).toContain('Panel aalcuadrado');
    // El JS y el CSS van con una huella para que el navegador no use una versión vieja.
    expect(res.headers['cache-control']).toBe('no-cache');
    const js = /src="(panel\.js\?v=[0-9a-f]{10})"/.exec(res.text)?.[1];
    expect(js).toBeDefined();
    expect(res.text).toMatch(/href="panel\.css\?v=[0-9a-f]{10}"/);
    await request(http).get(`/panel/${js}`).expect(200);
    await request(http).get('/panel').expect(301).expect('Location', '/panel/');
  });
});
