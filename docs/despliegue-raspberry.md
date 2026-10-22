# Levantar la API en una Raspberry Pi y exponerla con Cloudflare Tunnel

> ¿Prefieres Docker? Sigue [docker.md](docker.md): levanta la API, la base de datos y el túnel con `docker compose`.

Esta guía deja la API corriendo en la Raspberry como servicio, con MariaDB (compatible con MySQL), las fotos en una carpeta fija y un túnel de Cloudflare que la publica en tu dominio (por ejemplo `https://api.tudominio.com`) **sin abrir puertos en tu router**.

```
Internet ──https──▶ Cloudflare ──túnel saliente──▶ cloudflared (Raspberry)
                                                        │
                                                        ▼
                                            API Nest en 127.0.0.1:3000
                                              │                 │
                                              ▼                 ▼
                                        MariaDB (local)   /var/lib/aalcuadrado/uploads
```

En los comandos, cambia:

| Valor de ejemplo | Qué poner |
| --- | --- |
| `api.tudominio.com` | El subdominio donde quieres la API. El dominio debe estar en tu cuenta de Cloudflare. |
| `antonio` | El usuario con el que entrarás al panel. |

## Requisitos

- Raspberry Pi 4 o 5 (o 3B+) con **Raspberry Pi OS de 64 bits** (Bookworm o más nuevo). Revísalo con `uname -m`: debe decir `aarch64`.
- Acceso por SSH a la Raspberry.
- Un dominio administrado en Cloudflare (los DNS del dominio apuntan a Cloudflare).
- Este repositorio en GitHub.

---

## 1. Preparar el sistema

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y git curl ca-certificates gnupg openssl
```

## 2. Instalar Node.js 24 (LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v24.x
```

## 3. Instalar la base de datos

Raspberry Pi OS no trae el paquete de MySQL de Oracle: se usa **MariaDB**, que es compatible. La API usa el mismo driver (`mysql2`) y los scripts de `database/` funcionan en ambos.

```bash
sudo apt install -y mariadb-server
sudo systemctl enable --now mariadb
sudo mariadb-secure-installation
```

En `mariadb-secure-installation` responde: mantener `unix_socket` para root (**sí**), quitar usuarios anónimos (**sí**), impedir root remoto (**sí**), borrar la base `test` (**sí**).

MariaDB solo escucha en `127.0.0.1` por defecto; confírmalo:

```bash
sudo ss -ltnp | grep 3306   # debe decir 127.0.0.1:3306
```

## 4. Crear el usuario del sistema y las carpetas

La API corre con un usuario sin privilegios, y las fotos viven fuera del código para que no se pierdan al actualizar.

```bash
sudo useradd --system --create-home --home-dir /opt/aalcuadrado --shell /usr/sbin/nologin aalcuadrado
sudo mkdir -p /var/lib/aalcuadrado/uploads
sudo chown -R aalcuadrado:aalcuadrado /var/lib/aalcuadrado
sudo chmod 750 /var/lib/aalcuadrado/uploads
```

## 5. Descargar y compilar la API

```bash
sudo -u aalcuadrado git clone https://github.com/AIMtonio/back-aalcuadrado.git /opt/aalcuadrado/back-aalcuadrado
cd /opt/aalcuadrado/back-aalcuadrado
sudo -u aalcuadrado npm ci
sudo -u aalcuadrado npm run build
```

> Si el repositorio es privado, usa una *deploy key* de solo lectura o un token: `git clone https://<TOKEN>@github.com/AIMtonio/back-aalcuadrado.git`.

## 6. Crear la base de datos, las tablas y el usuario de la API

```bash
cd /opt/aalcuadrado/back-aalcuadrado

# Base de datos y tablas
sudo mariadb < database/01_crear_base_de_datos.sql

# Usuario de base de datos con contraseña aleatoria (se aplica sin editar el archivo)
DB_PASS=$(openssl rand -base64 24 | tr -d '/+=')
sed "s/CAMBIA_ESTA_CONTRASENA/${DB_PASS}/g" database/02_crear_usuario_bd.sql | sudo mariadb
echo "Contraseña de la base de datos: ${DB_PASS}"   # cópiala para el paso 7

# Los productos que hoy tiene el front (se puede correr más de una vez)
sudo mariadb < database/03_productos_iniciales.sql
```

Revisa los permisos:

```bash
sudo mariadb -e "SHOW GRANTS FOR 'aalcuadrado_api'@'localhost';"
```

Debe mostrar solo esto (y lo mismo para `@'127.0.0.1'`):

```
GRANT USAGE ON *.* TO `aalcuadrado_api`@`localhost` ...
GRANT SELECT, INSERT, UPDATE ON `aalcuadrado`.`usuarios` TO `aalcuadrado_api`@`localhost`
GRANT SELECT, INSERT, UPDATE, DELETE ON `aalcuadrado`.`imagenes` TO `aalcuadrado_api`@`localhost`
GRANT SELECT, INSERT, UPDATE, DELETE ON `aalcuadrado`.`productos` TO `aalcuadrado_api`@`localhost`
GRANT SELECT, INSERT, UPDATE, DELETE ON `aalcuadrado`.`producto_colores` TO `aalcuadrado_api`@`localhost`
```

El usuario de la API **no** puede crear, alterar ni borrar tablas, ni ver otras bases, ni conectarse desde fuera de la Raspberry.

## 7. Configurar el `.env`

```bash
cd /opt/aalcuadrado/back-aalcuadrado
sudo -u aalcuadrado cp .env.example .env
sudo -u aalcuadrado chmod 600 .env
openssl rand -base64 48   # cópialo para JWT_SECRET
sudo -u aalcuadrado nano .env
```

Valores para producción:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
PUBLIC_URL=https://api.tudominio.com
CORS_ORIGINS=https://aimtonio.github.io

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=aalcuadrado_api
DB_PASSWORD=<la contraseña del paso 6>
DB_NAME=aalcuadrado

JWT_SECRET=<la salida de openssl rand -base64 48>
JWT_EXPIRA_SEGUNDOS=28800

UPLOADS_DIR=/var/lib/aalcuadrado/uploads
UPLOADS_MAX_MB=10

# Opcional: Deploy Hook de Vercel para el botón "Publicar sitio" del panel
DEPLOY_HOOK_URL=
```

- `HOST=127.0.0.1` hace que la API no sea visible en tu red local: solo `cloudflared` llega a ella.
- `CORS_ORIGINS` es el dominio de tu front. Si le pones dominio propio a GitHub Pages, agrégalo separado por coma.

## 8. Crear tu usuario del panel

```bash
cd /opt/aalcuadrado/back-aalcuadrado
sudo -u aalcuadrado npm run usuario:crear -- antonio
```

Te pide la contraseña dos veces sin mostrarla (mínimo 12 caracteres). Si ya existe, le cambia la contraseña: úsalo también si la olvidas.

## 9. Dejar la API como servicio

```bash
sudo cp deploy/aalcuadrado-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now aalcuadrado-api
systemctl status aalcuadrado-api
journalctl -u aalcuadrado-api -f   # logs en vivo (Ctrl+C para salir)
```

> Si instalaste MySQL en lugar de MariaDB, cambia `mariadb.service` por `mysql.service` en el archivo del servicio.

Prueba local, desde la Raspberry:

```bash
# Sin token: 401
curl -i http://127.0.0.1:3000/api/imagenes

# Con token
TOKEN=$(curl -s http://127.0.0.1:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"usuario":"antonio","password":"TU_CONTRASEÑA"}' | sed -E 's/.*"access_token":"([^"]+)".*/\1/')
curl -s http://127.0.0.1:3000/api/imagenes -H "Authorization: Bearer $TOKEN"   # []
```

## 10. Instalar cloudflared

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared
cloudflared --version
```

## 11. Crear el túnel y el DNS

```bash
# 1. Autoriza la Raspberry en tu cuenta. Abre el enlace que imprime en cualquier navegador
#    y elige tu dominio. Deja ~/.cloudflared/cert.pem.
cloudflared tunnel login

# 2. Crea el túnel. Imprime su ID (un UUID) y deja ~/.cloudflared/<ID>.json.
cloudflared tunnel create aalcuadrado-api

# 3. Crea el registro DNS (CNAME api.tudominio.com → <ID>.cfargotunnel.com).
cloudflared tunnel route dns aalcuadrado-api api.tudominio.com
```

## 12. Configurar el túnel y dejarlo como servicio

```bash
TUNNEL_ID=$(cloudflared tunnel list | awk '/aalcuadrado-api/ {print $1}')
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/${TUNNEL_ID}.json /etc/cloudflared/
sudo chmod 600 /etc/cloudflared/${TUNNEL_ID}.json

cd /opt/aalcuadrado/back-aalcuadrado
sed "s/<TUNNEL_ID>/${TUNNEL_ID}/g; s/api.tudominio.com/api.TU-DOMINIO-REAL.com/" deploy/cloudflared-config.yml \
  | sudo tee /etc/cloudflared/config.yml

sudo cloudflared tunnel ingress validate --config /etc/cloudflared/config.yml
sudo cloudflared service install
sudo systemctl enable --now cloudflared
systemctl status cloudflared
```

> **Alternativa desde el panel de Cloudflare:** en *Zero Trust → Networks → Tunnels → Create a tunnel* creas el túnel, eliges *Debian / arm64*, copias el comando `sudo cloudflared service install <TOKEN>` y en *Public Hostname* pones `api.tudominio.com` → `HTTP` → `127.0.0.1:3000`. Con esa opción te saltas los pasos 11 y 12.

## 13. Probar desde fuera

Desde tu computadora o celular (con datos, no Wi-Fi, para probar de verdad desde fuera):

```bash
curl -i https://api.tudominio.com/api/imagenes          # 401: protegida
```

Y abre **`https://api.tudominio.com/panel/`**: inicia sesión, sube una foto y usa "Copiar URL". Esa URL (`https://api.tudominio.com/uploads/galeria/...`) se abre sin token, que es lo que necesita el front para mostrarla.

---

## Endpoints

Todas las rutas de `/api` piden `Authorization: Bearer <token>`, salvo el login.

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `POST` | `/api/auth/login` | **Pública.** `{ "usuario", "password" }` → `{ access_token, token_type, expires_in }`. Máximo 5 intentos por minuto por IP. |
| `GET` | `/api/usuarios/yo` | Datos del usuario del token. |
| `PATCH` | `/api/usuarios/yo/password` | `{ "passwordActual", "passwordNueva" }` → 204. |
| `GET` | `/api/productos` | Productos con sus colores y cuántas fotos tiene cada uno. |
| `GET` | `/api/productos/:slug` | Un producto. |
| `POST` | `/api/productos` | Crea un producto: `nombre`, `coleccion` y, opcionales, `slug`, `descripcion`, `etiqueta`, `precio`, `disponible`, `destacado`, `orden`, `colores`. |
| `PATCH` | `/api/productos/:slug` | Edita un producto (todo menos el slug). `colores` reemplaza la lista. |
| `DELETE` | `/api/productos/:slug` | Borra un producto sin fotos (con fotos responde 409). |
| `GET` | `/api/imagenes?categoria=&producto=` | Lista de fotos (filtros opcionales), por `orden`. Cada una trae su `url`. |
| `GET` | `/api/imagenes/:id` | Una foto. |
| `POST` | `/api/imagenes` | `multipart/form-data`: `archivos` (1 a 10), `categoria` (`productos` o `galeria`) y, opcionales, `producto`, `color`, `alt`, `orden`. |
| `PATCH` | `/api/imagenes/:id` | Cambia `alt`, `producto`, `color`, `orden` o `categoria` (mueve el archivo de carpeta). |
| `DELETE` | `/api/imagenes/:id` | Borra el registro y el archivo. |
| `GET` | `/api/publicacion` | Si el botón "Publicar sitio" está configurado y cuándo se usó por última vez. |
| `POST` | `/api/publicacion` | Llama al Deploy Hook del front (`DEPLOY_HOOK_URL`) para volver a publicar el sitio. |
| `GET` | `/uploads/<categoria>/<archivo>` | El archivo de la foto. Público, para que `<img src>` funcione. |
| `GET` | `/panel/` | El panel, con dos pestañas: **Fotos** (subir, editar, borrar) y **Productos** (crear, editar, borrar). La página es pública, pero todo lo que hace pide el token. |

`producto` y `color` son el *slug* del producto y el *id* del color tal como los usa el front (`nochebuena`, `rojo`, `rosa-mexicano`).

La API revisa los primeros bytes de cada archivo: solo acepta JPG, PNG, WebP y AVIF de verdad, aunque el archivo diga otra cosa en su nombre. El nombre en disco lo genera la API (`aretes-en-caja-3f9a1c2b.jpg`).

## Conectar el front

Sigue [integracion-front.md](integracion-front.md). En resumen: el GitHub Action del front inicia sesión con `API_USUARIO` y `API_PASSWORD` (guardados como *secrets*), descarga los productos y las fotos (`npm run api:sincronizar`) y Astro arma el sitio con ellos. El navegador nunca llama a `/api`. Después de cambiar productos o fotos en el panel, vuelve a ejecutar el workflow del front para publicarlos.

Para probar los endpoints a mano está [aalcuadrado-api.postman_collection.json](aalcuadrado-api.postman_collection.json).

## Actualizar la API

```bash
cd /opt/aalcuadrado/back-aalcuadrado
sudo -u aalcuadrado git pull
sudo -u aalcuadrado npm ci
sudo -u aalcuadrado npm run build
sudo systemctl restart aalcuadrado-api
```

Si una versión nueva cambia las tablas, trae su script en `database/` y se corre con `sudo mariadb < database/<script>.sql` antes de reiniciar.

**Si tu base es anterior al módulo de productos**, corre esto una vez antes de reiniciar (los tres scripts se pueden repetir sin dañar lo que ya existe; `02` no cambia la contraseña de un usuario que ya existe):

```bash
sudo mariadb < database/01_crear_base_de_datos.sql      # crea productos y producto_colores
sed "s/CAMBIA_ESTA_CONTRASENA/no-se-usa/g" database/02_crear_usuario_bd.sql | sudo mariadb   # permisos nuevos
sudo mariadb < database/03_productos_iniciales.sql      # los 3 productos actuales del front
```

## Respaldos

Las fotos y la base se respaldan juntas: una no sirve sin la otra.

```bash
sudo mkdir -p /var/backups/aalcuadrado
sudo mariadb-dump --single-transaction aalcuadrado | gzip | sudo tee /var/backups/aalcuadrado/bd-$(date +%F).sql.gz >/dev/null
sudo tar -czf /var/backups/aalcuadrado/fotos-$(date +%F).tar.gz -C /var/lib/aalcuadrado uploads
```

Copia `/var/backups/aalcuadrado` fuera de la Raspberry (otro disco, la nube): si la tarjeta SD falla, se pierde todo lo que esté en ella.

## Seguridad

- **No hay puertos abiertos:** `cloudflared` sale hacia Cloudflare; la API y MariaDB solo escuchan en `127.0.0.1`.
- **Login:** contraseña con bcrypt, 5 intentos por minuto por IP, y el mismo tiempo de respuesta exista o no el usuario.
- **Capa extra opcional para el panel:** en *Zero Trust → Access → Applications*, crea una aplicación *Self-hosted* para `api.tudominio.com/panel` con una política que permita solo tu correo. Cloudflare te pedirá un código por correo antes de mostrar el panel. No la pongas en `/api` ni en `/uploads`, o el front ya no podrá leer.
- **Tamaño de subida:** Cloudflare (plan gratis) corta peticiones de más de 100 MB. Con `UPLOADS_MAX_MB=10` y 10 fotos por vez se puede llegar al límite: sube en tandas más chicas si ves un error 413.
- **El token dura 8 horas** (`JWT_EXPIRA_SEGUNDOS`). Cambiar `JWT_SECRET` y reiniciar la API invalida todos los tokens emitidos.

## Problemas comunes

| Síntoma | Causa probable |
| --- | --- |
| `journalctl` dice `Faltan variables de entorno` | Falta un valor en `.env`, o el servicio no corre en la carpeta del proyecto. |
| `Access denied for user 'aalcuadrado_api'` | `DB_PASSWORD` no coincide con la del paso 6. Cámbiala con `ALTER USER` (ver el final de `database/02_crear_usuario_bd.sql`). |
| `command denied ... for table` | Se agregó una tabla nueva sin darle permisos al usuario de la API: vuelve a correr `02_crear_usuario_bd.sql` (paso 6). |
| `Table 'aalcuadrado.productos' doesn't exist` | La base se creó con una versión anterior: corre `01`, `02` y `03` de `database/` (ver *Actualizar la API*). |
| `EACCES` al subir fotos | `/var/lib/aalcuadrado/uploads` no es de `aalcuadrado`: repite el `chown` del paso 4. |
| Error 502 en `api.tudominio.com` | La API no está corriendo: `systemctl status aalcuadrado-api`. |
| Error 1033 de Cloudflare | `cloudflared` no está corriendo: `systemctl status cloudflared`. |
| El front no ve las fotos | Falta el dominio en `image.remotePatterns`, o `PUBLIC_URL` no es la URL pública. |
