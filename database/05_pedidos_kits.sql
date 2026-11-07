-- =====================================================================
-- aalcuadrado · 05. Pedidos de kits (jabón + vela)
-- Para una base que ya existe (si vienes de una instalación nueva, esto ya
-- lo trae database/01_crear_base_de_datos.sql y este script no hace nada).
-- Ejecutar con un usuario administrador (root):
--   sudo mysql < database/05_pedidos_kits.sql
-- Compatible con MySQL 8+ y MariaDB 10.6+. Se puede correr más de una vez.
-- =====================================================================

USE aalcuadrado;

-- Pedidos que llegan desde el front. Los cotiza y los hace el dueño a mano
-- (pestaña Pedidos del panel); por eso no se validan existencias ni precios aquí.
CREATE TABLE IF NOT EXISTS pedidos_kits (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  cliente_nombre    VARCHAR(100)  NOT NULL,
  cliente_contacto  VARCHAR(150)  NOT NULL COMMENT 'Correo o teléfono de quien pidió',
  jabon_color       VARCHAR(60)   NOT NULL,
  jabon_aroma       VARCHAR(60)   NOT NULL,
  jabon_forma       VARCHAR(60)   NOT NULL,
  vela_color        VARCHAR(60)   NOT NULL,
  vela_aroma        VARCHAR(60)   NOT NULL,
  vela_topping      VARCHAR(60)   NOT NULL,
  creado_en         DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_pedidos_kits_creado_en (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Después de correr esto, dale permisos al usuario de la API con database/02_crear_usuario_bd.sql
-- (ya incluye el GRANT de `pedidos_kits`; se puede volver a correr sin problema).
