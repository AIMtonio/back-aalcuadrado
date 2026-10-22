-- =====================================================================
-- aalcuadrado · 02. Usuario de base de datos para la API
-- Ejecutar con un usuario administrador (root), DESPUÉS del script 01.
--
-- 1. Cambia 'CAMBIA_ESTA_CONTRASENA' por una contraseña larga y aleatoria
--    (por ejemplo, la salida de: openssl rand -base64 24).
-- 2. Ejecuta:  sudo mysql < database/02_crear_usuario_bd.sql
-- 3. Pon la misma contraseña en DB_PASSWORD del archivo .env.
--
-- El usuario solo puede conectarse desde la misma máquina (localhost) y
-- solo tiene permisos de datos (leer/escribir) sobre las dos tablas que usa
-- la API. No puede crear, alterar ni borrar tablas, ni ver otras bases.
-- =====================================================================

-- 'localhost' cubre la conexión por socket; '127.0.0.1', la conexión TCP (DB_HOST=127.0.0.1).
CREATE USER IF NOT EXISTS 'aalcuadrado_api'@'localhost' IDENTIFIED BY 'CAMBIA_ESTA_CONTRASENA';
CREATE USER IF NOT EXISTS 'aalcuadrado_api'@'127.0.0.1' IDENTIFIED BY 'CAMBIA_ESTA_CONTRASENA';

-- usuarios: leer (login), insertar (npm run usuario:crear) y actualizar
-- (último acceso y cambio de contraseña). Sin DELETE.
GRANT SELECT, INSERT, UPDATE ON aalcuadrado.usuarios TO 'aalcuadrado_api'@'localhost';
GRANT SELECT, INSERT, UPDATE ON aalcuadrado.usuarios TO 'aalcuadrado_api'@'127.0.0.1';

-- imagenes: lectura y escritura completas (listar, subir, editar y borrar).
GRANT SELECT, INSERT, UPDATE, DELETE ON aalcuadrado.imagenes TO 'aalcuadrado_api'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON aalcuadrado.imagenes TO 'aalcuadrado_api'@'127.0.0.1';

FLUSH PRIVILEGES;

-- Para revisar los permisos:
--   SHOW GRANTS FOR 'aalcuadrado_api'@'localhost';
--
-- Para cambiar la contraseña más adelante:
--   ALTER USER 'aalcuadrado_api'@'localhost' IDENTIFIED BY 'nueva';
--   ALTER USER 'aalcuadrado_api'@'127.0.0.1' IDENTIFIED BY 'nueva';
