# back-aalcuadrado

API de [aalcuadrado](https://github.com/AIMtonio/front-aalcuadrado) hecha con NestJS y MySQL/MariaDB. Sirve para subir fotos desde un panel privado y que el front las lea.

- **Login con JWT:** `POST /api/auth/login` es la única ruta pública de `/api` (junto con `/api/disenos` y `/api/pedidos`, pensadas para que el sitio las llame sin iniciar sesión). Todo lo demás pide `Authorization: Bearer <token>`.
- **Un solo usuario**, que se crea por consola (no hay registro público).
- **Panel** en `/panel/` para administrar productos, categorías, fotos y pedidos.
- **Productos** (nombre, colección, categoría, colores, descripción, disponibilidad) en las tablas `productos` y `producto_colores`.
- **Categorías de aretes** (tabla `categorias`), para agrupar los productos como quieras desde el panel.
- **Fotos en disco**, en `UPLOADS_DIR/<categoria>/`, servidas en `/uploads/...` y registradas en la tabla `imagenes`. Cada foto de producto apunta a un producto y color que existen.
- **Pedidos de kits** (jabón + vela, tabla `pedidos_kits`): el sitio está creciendo de aretes a también vender estos kits a la medida. El front manda el pedido (`POST /api/pedidos`, pública) y el dueño lo ve en el panel para cotizarlo y hacerlo a mano.

## Estructura

```
src/
  auth/        login, guard global de JWT y decorador @Publico()
  usuarios/    tabla usuarios, perfil y cambio de contraseña
  productos/   tablas productos y producto_colores, alta, edición y borrado
  categorias/  tabla categorias, alta, edición y borrado
  imagenes/    tabla imagenes, subida (multipart), edición y borrado
  pedidos/     tabla pedidos_kits: alta pública, listado y borrado para el panel
  config/      validación de variables de entorno
  cli/         npm run usuario:crear
public/panel/  panel (HTML + CSS + JS, sin dependencias)
database/      scripts SQL: base, tablas, usuario y permisos
deploy/        servicio systemd y configuración de cloudflared (sin Docker)
docker/        script de inicio de MariaDB para Docker
docs/          guía de despliegue en Raspberry Pi
```

## Desarrollo local

Necesitas Node 22.13 o más nuevo y un MySQL 8+ o MariaDB 10.6+.

```bash
npm install

# Base de datos, tablas y usuario de la API (cambia la contraseña en el script o usa sed)
mysql -u root -p < database/01_crear_base_de_datos.sql
mysql -u root -p < database/02_crear_usuario_bd.sql
mysql -u root -p < database/03_productos_iniciales.sql

cp .env.example .env        # llena DB_PASSWORD y JWT_SECRET
npm run build
npm run usuario:crear -- antonio
npm run start:dev
```

Abre <http://localhost:3000/panel/>.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run start:dev` | API en modo desarrollo, se reinicia con cada cambio. |
| `npm run build` | Compila a `dist/`. |
| `npm run start:prod` | Corre lo compilado. |
| `npm run usuario:crear -- <usuario>` | Crea el usuario del panel o le cambia la contraseña. Requiere `npm run build`. |
| `npm test` | Pruebas unitarias. |
| `npm run test:e2e` | Pruebas de los endpoints sobre SQLite en memoria (no necesitan MySQL). |
| `npm run lint` | Revisa el código con oxlint. |

## Base de datos

Las tablas las crean los scripts de `database/`, no la API (`synchronize: false`). El usuario de base de datos de la API solo tiene `SELECT, INSERT, UPDATE` en `usuarios`; `SELECT, INSERT, UPDATE, DELETE` en `imagenes`, `productos`, `producto_colores` y `categorias`; y `SELECT, INSERT, DELETE` en `pedidos_kits` (el panel no edita un pedido, solo lo borra al cotizarlo). Si agregas una tabla, agrégale su script y sus permisos.

`01_crear_base_de_datos.sql` ya crea todas las tablas (instalación nueva). Si tu base es anterior a `categorias` o `pedidos_kits`, corre además `04_categorias.sql` y `05_pedidos_kits.sql` (y vuelve a correr `02_crear_usuario_bd.sql` para los permisos nuevos); los tres se pueden repetir sin dañar lo que ya existe.

## Despliegue

- [docs/docker.md](docs/docker.md): con Docker Compose (API, MariaDB y Cloudflare Tunnel).
- [docs/despliegue-raspberry.md](docs/despliegue-raspberry.md): sin Docker (Raspberry Pi, MariaDB, systemd y Cloudflare Tunnel).
- [docs/integracion-front.md](docs/integracion-front.md): contrato de la API y cambios para el front.
- [docs/aalcuadrado-api.postman_collection.json](docs/aalcuadrado-api.postman_collection.json): colección para Postman, Insomnia o Bruno.
