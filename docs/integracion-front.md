# Integrar la API en el front (front-aalcuadrado)

Esta guía es para el repositorio [front-aalcuadrado](https://github.com/AIMtonio/front-aalcuadrado). Explica cómo el sitio lee los **productos** y las **fotos** que se administran desde el panel de la API, sin perder la optimización de imágenes de Astro y sin exponer el usuario ni la contraseña.

Los cambios del front ya están hechos en la rama [`feature/integracion-api`](https://github.com/AIMtonio/front-aalcuadrado/tree/feature/integracion-api). Para probar los endpoints a mano, importa [`aalcuadrado-api.postman_collection.json`](aalcuadrado-api.postman_collection.json) en Postman, Insomnia o Bruno.

## Resumen

```
Panel (/panel/) ──productos y fotos──▶ API (Raspberry) ──▶ MariaDB + /var/lib/aalcuadrado/uploads
                                            ▲
                                            │ 1. login · 2. productos · 3. fotos · 4. descarga
GitHub Action del front ────────────────────┘
  npm run api:sincronizar  → src/content/fotos/api/**  +  src/content/catalogo-api.json
  npm run build            → Astro arma el catálogo y optimiza las fotos como si fueran del repositorio
```

- **El front sigue siendo estático.** Todo se descarga **al compilar**. Las fotos quedan en `src/content/fotos/api/` y Astro las procesa como cualquier otra foto local (AVIF/WebP, `srcset`, visor, imagen OG). Ningún componente `.astro` cambia.
- **Las credenciales viven en GitHub Secrets.** El navegador nunca llama a `/api`, así que no necesita token ni CORS.
- **Con la API, los productos son los de la API.** Un JSON de `src/content/productos/` con el mismo slug solo presta sus fotos mientras la API no tenga fotos de ese producto. Lo mismo con la galería: en cuanto hay al menos una foto de `galeria` (pestaña **Así se ven** del panel), la sección "Así se ven" muestra solo esas, en su `orden`, y deja de usar `galeria.json`.
- **Sin `API_URL` no se descarga nada** y el sitio compila como antes, con los JSON del repositorio.

---

## Contrato de la API

URL base: la de tu túnel, por ejemplo `https://api.tudominio.com`. Todas las rutas de `/api` responden JSON y piden `Authorization: Bearer <token>`, salvo el login.

### `POST /api/auth/login` (pública)

```http
POST /api/auth/login
Content-Type: application/json

{ "usuario": "antonio", "password": "••••••••••••" }
```

`200 OK`

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 28800
}
```

| Estado | Cuándo |
| --- | --- |
| `400` | Falta `usuario` o `password`. |
| `401` | Usuario o contraseña incorrectos (mismo mensaje en ambos casos). |
| `429` | Más de 5 intentos en un minuto desde la misma IP. |

### `GET /api/productos`

Todos los productos con sus colores, ordenados por nombre.

```json
[
  {
    "id": 1,
    "slug": "papel-picado-calaverita",
    "nombre": "Papel picado calaverita",
    "coleccion": "dia-de-muertos",
    "descripcion": "Una calaverita calada como el papel picado de las ofrendas, pero que no se rompe ni se arruga.",
    "etiqueta": "Temporada",
    "precio": 120,
    "disponible": true,
    "destacado": true,
    "orden": 1,
    "categoria": { "id": 1, "slug": "arracadas", "nombre": "Arracadas" },
    "colores": [
      { "id": "morado", "nombre": "Morado", "hex": "#3B2A9B" },
      { "id": "rosa-mexicano", "nombre": "Rosa mexicano", "hex": "#E4007C" }
    ],
    "totalFotos": 0,
    "creadoEn": "2026-10-22T05:10:00.000Z",
    "actualizadoEn": "2026-10-22T05:10:00.000Z"
  }
]
```

| Campo | Valores | En el front |
| --- | --- | --- |
| `slug` | minúsculas, números y guiones; **no cambia** | `Producto.slug` (enlaces `#producto/<slug>`) |
| `coleccion` | `dia-de-muertos`, `mexicanos`, `patrios`, `navidad`, `otros` | `ColeccionId` |
| `etiqueta` | `Nuevo`, `Temporada`, `Más vendido` o `null` | `ETIQUETAS` |
| `descripcion` | hasta 240 caracteres (`""` si no hay) | |
| `precio` | número o `null` | Hoy el sitio lo ignora y usa `sitio.precios.listo`. |
| `disponible`, `destacado` | booleanos | |
| `orden` | entero o `null` | |
| `categoria` | `{ id, slug, nombre }` o `null` (categoría de aretes, ver abajo) | |
| `colores[].id` | lo que guardan las fotos en `color` | `Color.id` |

### `POST /api/productos` · `PATCH /api/productos/:slug` · `DELETE /api/productos/:slug`

```http
POST /api/productos
Content-Type: application/json

{
  "nombre": "Corazón de talavera",
  "coleccion": "mexicanos",
  "descripcion": "El trazo de la talavera poblana en un corazón ligero.",
  "etiqueta": "Nuevo",
  "categoriaId": 1,
  "colores": [
    { "nombre": "Azul cobalto", "hex": "#1F3FAE" },
    { "nombre": "Amarillo", "hex": "#F2B705" }
  ]
}
```

- Al crear, `nombre` y `coleccion` son obligatorios. Si no mandas `slug`, se arma del nombre (`corazon-de-talavera`); si ya existe, responde `409`.
- El `id` de cada color se arma de su nombre si no viene (`Azul cobalto` → `azul-cobalto`). Dos colores con el mismo id: `400`.
- `categoriaId` es el `id` de una categoría de `GET /api/categorias` (opcional). `null` o `""` la quita. Un id que no existe: `400`.
- `PATCH` acepta los mismos campos menos `slug`, todos opcionales. Si mandas `colores`, la lista **reemplaza** a la anterior. Para conservar un color, manda su `id`. Las fotos de un color que se quita se quedan sin color.
- `DELETE` responde `409` si el producto tiene fotos: hay que borrarlas o pasarlas a otro producto primero.

### `GET /api/categorias`

Categorías de aretes administradas desde el panel (pestaña Categorías), ordenadas por `orden` y luego por `nombre`.

```json
[
  {
    "id": 1,
    "slug": "arracadas",
    "nombre": "Arracadas",
    "orden": 0,
    "totalProductos": 3,
    "creadoEn": "2026-11-07T05:10:00.000Z",
    "actualizadoEn": "2026-11-07T05:10:00.000Z"
  }
]
```

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| `GET` | `/api/categorias/:slug` | — | `200` una categoría · `404` |
| `POST` | `/api/categorias` | `nombre` obligatorio; opcionales `slug` (se arma del nombre si no viene) y `orden` | `201` · `409` si el slug ya existe |
| `PATCH` | `/api/categorias/:slug` | `nombre`, `orden` (todo opcional; el slug no cambia) | `200` |
| `DELETE` | `/api/categorias/:slug` | — | `204` · `409` si tiene productos asignados (quítales la categoría primero) |

### `GET /api/imagenes`

Filtros opcionales: `categoria` (`productos` o `galeria`) y `producto` (slug). Sale ordenada por `orden` y luego por `id`.

```json
[
  {
    "id": 1,
    "categoria": "productos",
    "archivo": "nochebuena-rojo-01-4449ca34.png",
    "nombreOriginal": "Nochebuena Rojo 01.png",
    "mime": "image/png",
    "tamanoBytes": 284113,
    "alt": "Aretes Nochebuena en rojo",
    "producto": "nochebuena",
    "color": "rojo",
    "orden": 0,
    "creadoEn": "2026-10-22T04:29:41.002Z",
    "actualizadoEn": "2026-10-22T04:29:41.002Z",
    "url": "https://api.tudominio.com/uploads/productos/nochebuena-rojo-01-4449ca34.png"
  }
]
```

| Campo | En el front |
| --- | --- |
| `categoria: "productos"` | Fotos de un producto. |
| `categoria: "galeria"` | Sección "Así se ven". |
| `producto` | Slug de un producto que existe en la API. |
| `color` | `id` de uno de los colores de ese producto, o `null`. |
| `alt` | Texto alternativo. Si es `null`, el front arma uno ("Aretes Nochebuena, en color rojo"). |
| `orden` | Orden de las fotos. La de `orden` más bajo es la **portada**. |

### `GET /uploads/<categoria>/<archivo>` (pública)

El archivo de la foto. No pide token y se puede usar desde cualquier dominio. Cache de 30 días: un archivo nunca cambia, porque cada subida genera un nombre nuevo.

### Resto de endpoints

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| `GET` | `/api/productos/:slug` | — | `200` un producto · `404` |
| `GET` | `/api/categorias/:slug` | — | `200` una categoría · `404` |
| `GET` | `/api/imagenes/:id` | — | `200` una imagen · `404` |
| `POST` | `/api/imagenes` | `multipart/form-data`: `archivos` (1 a 10), `categoria`, y opcionales `producto`, `color`, `alt`, `orden` | `201` lista de imágenes creadas |
| `PATCH` | `/api/imagenes/:id` | JSON con `alt`, `producto`, `color`, `orden` o `categoria` (`""` o `null` borra el valor) | `200` imagen actualizada |
| `DELETE` | `/api/imagenes/:id` | — | `204` |
| `GET` | `/api/usuarios/yo` | — | `200` `{ id, usuario, activo, ultimoAcceso, creadoEn, actualizadoEn }` |
| `PATCH` | `/api/usuarios/yo/password` | `{ passwordActual, passwordNueva }` | `204` |

Al subir varias fotos juntas, reciben `orden`, `orden + 1`, `orden + 2`… en el orden en que se eligieron.

Reglas de las fotos (al subir y al editar):

- Una foto de `productos` **debe** tener un `producto` que exista, y su `color` (si lo trae) debe ser de ese producto. Si no, `400`.
- En `galeria`, `producto` y `color` se guardan vacíos aunque se manden.
- `alt` no puede ser una URL.

### Errores

Siempre con esta forma. `message` es un texto o, en errores de validación, una lista:

```json
{ "message": "Falta el token", "error": "Unauthorized", "statusCode": 401 }
```

| Estado | Ejemplo de `message` |
| --- | --- |
| `400` | `"\"foto.jpg\" no es una imagen JPG, PNG, WebP o AVIF"` · `"Elige el producto: …"` · `"No existe el producto \"x\". Créalo primero en Productos."` · `"\"Nochebuena\" no tiene el color \"verde\""` · `"Hay dos colores con el id \"rojo\""` |
| `401` | `"Falta el token"` · `"Token inválido o vencido"` |
| `404` | `"No existe la imagen 999"` · `"No existe el producto \"x\""` |
| `409` | `"Ya existe un producto con el slug \"x\""` · `"\"Nochebuena\" tiene 2 foto(s). Bórralas o pásalas a otro producto antes de borrarlo."` |
| `413` | Una foto pasa de `UPLOADS_MAX_MB` (10 MB por defecto). |
| `429` | Demasiadas peticiones (120 por minuto en general; 5 por minuto en el login). |

---

## Qué tiene el front (rama `feature/integracion-api`)

| Archivo | Qué hace |
| --- | --- |
| `scripts/sincronizar-api.mjs` (`npm run api:sincronizar`) | Inicia sesión, pide `/api/productos` y `/api/imagenes`, descarga cada foto desde `/uploads/...` a `src/content/fotos/api/<categoria>/` y escribe `src/content/catalogo-api.json` con `{ productos, fotos }`. Sin `API_URL` no hace nada. Borra las fotos descargadas antes, así una foto borrada en el panel desaparece del sitio. |
| `src/domain/catalogo.ts` | `ProductoApiSchema`, `FotoApiSchema` y `CatalogoApiJsonSchema` validan `catalogo-api.json`. |
| `src/data/CatalogoArchivosLocales.ts` | Si existe `catalogo-api.json`, arma los productos con él. Las fotos de cada producto son las de la API; si no tiene, usa las de su JSON del repositorio (mismo slug). Avisa al compilar si una foto no tiene producto, si su producto no existe o si su color no es del producto. |
| `.gitignore` | Ignora `src/content/fotos/api/` y `src/content/catalogo-api.json`. |
| `package.json` | `prebuild` corre `api:sincronizar` antes de cada `npm run build` (en Vercel, en GitHub Actions y en local). |
| `astro.config.mjs` | En Vercel, si no hay `SITE_URL`, usa `VERCEL_PROJECT_PRODUCTION_URL`. |
| `.github/workflows/desplegar.yml` | Pasa los secrets `API_URL`, `API_USUARIO` y `API_PASSWORD` al paso de compilar. Si la API no responde, el build falla y no se publica nada. |

### Secrets en GitHub

En el repositorio del front: *Settings → Secrets and variables → Actions → New repository secret*.

| Secret | Valor |
| --- | --- |
| `API_URL` | `https://api.tudominio.com` (sin `/` al final) |
| `API_USUARIO` | Tu usuario del panel |
| `API_PASSWORD` | Su contraseña |

## Publicar después de cambiar productos o fotos

El sitio se compila con lo que hay en ese momento: cada cambio en el panel necesita una compilación nueva. El sincronizador no se corre a mano: `npm run build` lo ejecuta solo (script `prebuild` del front).

**Con Vercel**

1. En el proyecto de Vercel, *Settings → Environment Variables*: `API_URL`, `API_USUARIO` y `API_PASSWORD`. `SITE_URL` es opcional: si no está, se usa el dominio de producción de Vercel.
2. *Settings → Git → Deploy Hooks*: crea uno para la rama `main` y copia la URL.
3. Pon esa URL en `DEPLOY_HOOK_URL` del `.env` de la API (o de `.env.docker`) y reinicia la API.
4. En el panel aparece **Publicar sitio**: después de tus cambios, un clic y el sitio se actualiza en 1 a 2 minutos.

La API llama al hook desde el servidor: la URL nunca llega al navegador.

| Método | Ruta | Respuesta |
| --- | --- | --- |
| `GET` | `/api/publicacion` | `{ configurada, ultima }`. `ultima` es `{ solicitadaEn, build }` o `null` (se pierde al reiniciar la API). |
| `POST` | `/api/publicacion` | `202` `{ solicitadaEn, build }` · `503` sin `DEPLOY_HOOK_URL` · `502` si el proveedor falla · `429` más de 3 por minuto |

**Con GitHub Pages:** *Actions → Publicar en GitHub Pages → Run workflow*, o `gh workflow run desplegar.yml -R AIMtonio/front-aalcuadrado`.

## Diseñar aretes con IA

El sitio puede mandar la idea de un visitante y mostrar unos aretes generados por OpenAI. Los dos endpoints son **públicos** (sin token), porque los llama el navegador del visitante; la llave de OpenAI vive solo en la API.

| Método | Ruta | Respuesta |
| --- | --- | --- |
| `GET` | `/api/disenos` | `{ disponible, restantesHoy }`. Si `disponible` es `false`, oculta el formulario. |
| `POST` | `/api/disenos` | Cuerpo `{ "texto": "calaveritas con flores rosas" }` (3 a 500 caracteres) → `200` `{ imagen, restantesHoy }` |

`imagen` es un *data URL* (`data:image/webp;base64,…`) que va directo en `<img src>`. Tarda de 20 a 60 segundos: muestra un estado de "generando".

Errores (`message` siempre en español, listo para mostrar):

| Código | Cuándo |
| --- | --- |
| `400` | `texto` vacío, muy corto o de más de 500 caracteres |
| `422` | OpenAI no quiso dibujar esa idea (moderación) |
| `429` | El visitante ya creó `OPENAI_MAX_IMAGENES_VISITANTE` diseños en la última hora (5 por defecto; el mensaje dice en cuántos minutos puede crear otro), se acabó el cupo del día (`OPENAI_MAX_IMAGENES_DIA`), o mandó más de 10 peticiones en un minuto (`ThrottlerException`). Los intentos que fallan no gastan cupo. |
| `502` | OpenAI falló o tardó más de 90 segundos |
| `503` | No hay `OPENAI_API_KEY`, o la llave no sirve o no tiene saldo |

La API arma el prompt: le pide a la IA actuar como diseñador 3D, un par de aretes impresos en 3D en PLA, foto de producto en fondo gris claro, sin texto ni personas, y al final agrega la idea del visitante. Está en `src/disenos/prompt.ts`.

```ts
const respuesta = await fetch(`${API_URL}/api/disenos`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ texto }),
});
const datos = await respuesta.json();
if (!respuesta.ok) throw new Error(datos.message);
imagen.src = datos.imagen;
```

El dominio del sitio debe estar en `CORS_ORIGINS` de la API.

## Pedidos de kits (jabón + vela)

El sitio está creciendo de aretes a también vender kits de jabón + vela a la medida. El front manda el pedido con lo que eligió quien visita el sitio; el dueño lo cotiza y lo hace a mano (no hay catálogo, precios ni inventario de este lado). Es **pública** (sin token).

### `POST /api/pedidos`

```http
POST /api/pedidos
Content-Type: application/json

{
  "clienteNombre": "Ana",
  "clienteContacto": "ana@correo.com",
  "jabonColor": "Lavanda",
  "jabonAroma": "Lavanda",
  "jabonForma": "Corazón",
  "velaColor": "Blanco",
  "velaAroma": "Vainilla",
  "velaTopping": "Flores secas"
}
```

`201 Created`: regresa el mismo pedido con `id` y `creadoEn`.

| Campo | Qué es |
| --- | --- |
| `clienteNombre` | Nombre de quien pide (para contactarlo). |
| `clienteContacto` | Correo **o** teléfono. La API acepta cualquiera de los dos formatos (no ambos a la vez). |
| `jabonColor`, `jabonAroma`, `jabonForma` | Cómo quiere el jabón. |
| `velaColor`, `velaAroma`, `velaTopping` | Cómo quiere la vela. |

Los ocho campos son obligatorios (texto, hasta 150 caracteres `clienteContacto` y 100/60 el resto). No hay un catálogo fijo de colores, aromas, formas o toppings: el front decide qué opciones mostrar (texto libre, `<select>` con sus propias opciones, etc.) y manda lo elegido tal cual.

| Estado | Cuándo |
| --- | --- |
| `400` | Falta algún campo, está vacío, pasa del máximo de caracteres, o `clienteContacto` no es un correo ni un teléfono válido. |
| `429` | Más de 5 pedidos en un minuto desde la misma IP. |

`GET /api/pedidos` y `DELETE /api/pedidos/:id` existen para el panel (piden token): el dueño los usa para ver los pedidos pendientes y borrarlos cuando ya los cotizó. El front no los necesita.

## Desarrollo local

1. Levanta la API (`npm run start:dev` en este repositorio).
2. En el front, crea un `.env` (ya está en su `.gitignore`):

   ```dotenv
   API_URL=http://localhost:3000
   API_USUARIO=antonio
   API_PASSWORD=tu-contraseña
   ```

3. `npm run api:sincronizar && npm run dev` (en `npm run dev` no corre solo; en `npm run build`, sí)

Vuelve a correr `npm run api:sincronizar` y **reinicia** `npm run dev` cuando cambies algo en el panel. Sin `.env`, el front funciona como siempre, con los productos y fotos del repositorio.
