-- =====================================================================
-- aalcuadrado · 04. Categorías de aretes
-- Para una base que ya existe (si vienes de una instalación nueva, esto ya
-- lo trae database/01_crear_base_de_datos.sql y este script no hace nada).
-- Ejecutar con un usuario administrador (root):
--   sudo mysql < database/04_categorias.sql
-- Compatible con MySQL 8+ y MariaDB 10.6+. Se puede correr más de una vez.
-- =====================================================================

USE aalcuadrado;

CREATE TABLE IF NOT EXISTS categorias (
  id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  slug            VARCHAR(100)   NOT NULL COMMENT 'No cambia después de crearse',
  nombre          VARCHAR(100)   NOT NULL,
  orden           INT            NOT NULL DEFAULT 0,
  creado_en       DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en  DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `productos.categoria_id` no existe en bases anteriores a este cambio: se agrega
-- con SQL dinámico porque ni MySQL 8 ni MariaDB soportan
-- "ADD COLUMN IF NOT EXISTS ... ADD CONSTRAINT" en la misma cláusula de forma portable.
SET @existe_columna := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'categoria_id'
);
SET @sql := IF(@existe_columna = 0,
  'ALTER TABLE productos
     ADD COLUMN categoria_id INT UNSIGNED NULL COMMENT ''Categoría de aretes (opcional, tabla categorias)'' AFTER coleccion,
     ADD KEY idx_productos_categoria (categoria_id),
     ADD CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id)
       REFERENCES categorias (id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE agregar_categoria_id FROM @sql;
EXECUTE agregar_categoria_id;
DEALLOCATE PREPARE agregar_categoria_id;

-- Después de correr esto, dale permisos al usuario de la API con database/02_crear_usuario_bd.sql
-- (ya incluye el GRANT de `categorias`; se puede volver a correr sin problema).
