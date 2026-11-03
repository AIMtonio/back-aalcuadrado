# Correr la API con Docker

`docker-compose.yml` levanta tres servicios:

| Servicio | Imagen | Qué hace |
| --- | --- | --- |
| `db` | `mariadb:11.4` | Base de datos. La primera vez crea las tablas, el usuario de la API (con permisos solo de datos) y los productos iniciales. No publica puertos: solo la ve la API. |
| `api` | `aalcuadrado-api` (este `Dockerfile`) | La API y el panel. Escucha en `127.0.0.1:3000` de la máquina. Las fotos van al volumen `fotos`. |
| `tunel` | `cloudflare/cloudflared` | Opcional (`--profile tunel`). Publica la API en tu dominio sin abrir puertos. |

La imagen funciona igual en una PC (amd64) que en una Raspberry Pi 4/5 con sistema de 64 bits (arm64). No compila nada nativo.

## Requisitos

- Docker Engine con el plugin Compose (`docker compose version`). En Raspberry Pi OS:

  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker $USER   # cierra sesión y vuelve a entrar
  ```

## 1. Variables

```bash
cp .env.docker.example .env.docker
chmod 600 .env.docker
openssl rand -base64 24               # MARIADB_ROOT_PASSWORD
openssl rand -base64 24 | tr -d '/+=' # DB_PASSWORD
openssl rand -base64 48               # JWT_SECRET
nano .env.docker
```

`DB_HOST`, `DB_PORT`, `DB_NAME`, `HOST`, `PORT`, `UPLOADS_DIR` y `TRUST_PROXY` los fija `docker-compose.yml`; no hace falta ponerlos.

## 2. Levantar

```bash
docker compose up -d --build
docker compose ps            # db y api deben decir "healthy"
docker compose logs -f api   # Ctrl+C para salir
```

La primera vez, `db` tarda unos segundos en inicializar. La API espera a que esté lista.

## 3. Crear tu usuario del panel

```bash
docker compose exec api node dist/cli/crear-usuario.js antonio
```

Pide la contraseña dos veces sin mostrarla. Si el usuario ya existe, le cambia la contraseña.

Prueba: abre `http://localhost:3000/panel/` en la misma máquina (o con un túnel SSH desde otra: `ssh -L 3000:127.0.0.1:3000 usuario@raspberry`).

## 4. Publicar con Cloudflare Tunnel

**Opción A: cloudflared en Docker (recomendada).**

1. En Cloudflare: *Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared*. Copia el token del comando de instalación (lo que va después de `--token`).
2. En *Public Hostname*: `api.tudominio.com` → tipo `HTTP` → URL **`api:3000`** (el nombre del servicio en Docker, no `localhost`).
3. Pon el token en `TUNNEL_TOKEN` de `.env.docker` y levanta con el perfil:

   ```bash
   docker compose --profile tunel up -d
   ```

**Opción B: cloudflared instalado en la máquina.** Sigue los pasos 10 a 12 de [despliegue-raspberry.md](despliegue-raspberry.md). Como la API publica `127.0.0.1:3000`, la configuración de `deploy/cloudflared-config.yml` sirve tal cual.

## Botón "Publicar sitio"

Pon el Deploy Hook de Vercel en `DEPLOY_HOOK_URL` de `.env.docker` y aplica con `docker compose up -d`. Ver [integracion-front.md](integracion-front.md#publicar-después-de-cambiar-productos-o-fotos).

## Actualizar

```bash
git pull
docker compose up -d --build
```

Los volúmenes (`datos-db` y `fotos`) no se tocan.

**Si una versión nueva trae tablas o permisos nuevos:** los scripts de inicio solo corren con el volumen vacío, así que en una base que ya existe hay que aplicarlos a mano:

```bash
docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD"' < database/01_crear_base_de_datos.sql
docker compose exec -T db sh -c '/docker-entrypoint-initdb.d/02_usuario_api.sh'
docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD"' < database/03_productos_iniciales.sql
```

Los tres se pueden repetir sin dañar lo que ya existe.

## Respaldos

```bash
mkdir -p respaldos
docker compose exec -T db sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction aalcuadrado' \
  | gzip > respaldos/bd-$(date +%F).sql.gz
docker run --rm -v aalcuadrado_fotos:/fotos:ro -v "$PWD/respaldos":/respaldo alpine \
  tar -czf /respaldo/fotos-$(date +%F).tar.gz -C /fotos .
```

Restaurar:

```bash
gunzip -c respaldos/bd-AAAA-MM-DD.sql.gz | docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" aalcuadrado'
docker run --rm -v aalcuadrado_fotos:/fotos -v "$PWD/respaldos":/respaldo alpine \
  tar -xzf /respaldo/fotos-AAAA-MM-DD.tar.gz -C /fotos
```

## Usar una base de datos que ya tienes (sin el contenedor `db`)

Si MariaDB ya corre en la máquina (instalada como en [despliegue-raspberry.md](despliegue-raspberry.md)):

1. El usuario de la API tiene que poder entrar desde la red de Docker. En la máquina:

   ```bash
   sudo mariadb -e "
     CREATE USER IF NOT EXISTS 'aalcuadrado_api'@'172.16.0.0/255.240.0.0' IDENTIFIED BY 'LA_MISMA_CONTRASEÑA';
     GRANT SELECT, INSERT, UPDATE ON aalcuadrado.usuarios TO 'aalcuadrado_api'@'172.16.0.0/255.240.0.0';
     GRANT SELECT, INSERT, UPDATE, DELETE ON aalcuadrado.imagenes TO 'aalcuadrado_api'@'172.16.0.0/255.240.0.0';
     GRANT SELECT, INSERT, UPDATE, DELETE ON aalcuadrado.productos TO 'aalcuadrado_api'@'172.16.0.0/255.240.0.0';
     GRANT SELECT, INSERT, UPDATE, DELETE ON aalcuadrado.producto_colores TO 'aalcuadrado_api'@'172.16.0.0/255.240.0.0';"
   ```

   Y MariaDB debe escuchar en la interfaz de Docker: en `/etc/mysql/mariadb.conf.d/50-server.cnf` cambia `bind-address` a `0.0.0.0` y bloquea el puerto 3306 desde fuera con el firewall (`sudo ufw deny 3306` si usas ufw). Reinicia con `sudo systemctl restart mariadb`.

2. Crea `docker-compose.override.yml` (Compose lo lee solo):

   ```yaml
   services:
     api:
       environment:
         DB_HOST: host.docker.internal
       extra_hosts:
         - "host.docker.internal:host-gateway"
   ```

3. Levanta solo la API: `docker compose up -d --build --no-deps api`.

## Problemas comunes

| Síntoma | Causa probable |
| --- | --- |
| `db` no arranca: `You need to specify one of MARIADB_ROOT_PASSWORD…` | Falta `MARIADB_ROOT_PASSWORD` en `.env.docker`. |
| La API se reinicia con `Access denied for user` | `DB_PASSWORD` cambió después de crear el volumen: el script de inicio solo corre la primera vez. Entra con `docker compose exec db mariadb -uroot -p` (pide `MARIADB_ROOT_PASSWORD`) y corre `ALTER USER 'aalcuadrado_api'@'%' IDENTIFIED BY 'la-de-.env.docker';`. O empieza de cero con `docker compose down -v` (**borra la base y las fotos**). |
| `Faltan variables de entorno` en los logs de `api` | Falta `JWT_SECRET`, `DB_PASSWORD` o `PUBLIC_URL` en `.env.docker`. |
| `port is already allocated` en el 3000 | Ya corre otra API (por ejemplo, la de systemd). Detenla: `sudo systemctl disable --now aalcuadrado-api`. |
| Cloudflare responde 502 | En *Public Hostname* la URL debe ser `api:3000`, no `localhost:3000`. |
| Todos los visitantes comparten el límite de 5 logins por minuto | `TRUST_PROXY` no incluye la IP de cloudflared. En Docker ya viene `loopback, uniquelocal`. |
