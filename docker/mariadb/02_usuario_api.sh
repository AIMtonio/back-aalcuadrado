#!/bin/bash
# Lo ejecuta la imagen de MariaDB la primera vez que arranca (volumen vacío),
# después de 01_crear_base_de_datos.sql y antes de 03_productos_iniciales.sql.
#
# Crea el usuario de la API con los mismos permisos mínimos que
# database/02_crear_usuario_bd.sql, pero para la red interna de Docker ('%'):
# la API vive en otro contenedor. La base no publica puertos hacia fuera.
set -euo pipefail

: "${DB_USER:?Falta DB_USER}"
: "${DB_PASSWORD:?Falta DB_PASSWORD}"

# Escapa comillas simples para usarlos dentro de '...' en SQL.
usuario=${DB_USER//\'/\'\'}
password=${DB_PASSWORD//\'/\'\'}

mariadb --protocol=socket -uroot -p"${MARIADB_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS '${usuario}'@'%' IDENTIFIED BY '${password}';
GRANT SELECT, INSERT, UPDATE ON aalcuadrado.usuarios TO '${usuario}'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON aalcuadrado.imagenes TO '${usuario}'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON aalcuadrado.productos TO '${usuario}'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON aalcuadrado.producto_colores TO '${usuario}'@'%';
FLUSH PRIVILEGES;
SQL

echo "[aalcuadrado] Usuario '${DB_USER}' creado con permisos solo de datos."
