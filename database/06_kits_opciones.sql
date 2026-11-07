-- =====================================================================
-- aalcuadrado · 06. Colores, aromas y fotos de kits
-- Para una base que ya existe: agrega la categoría de fotos "kits", crea las
-- tablas de colores y aromas, y las llena con las opciones que el sitio
-- tenía fijas. En una instalación nueva las tablas ya existen (01) y solo
-- se cargan las opciones.
-- Ejecutar con un usuario administrador (root):
--   sudo mysql < database/06_kits_opciones.sql
-- Compatible con MySQL 8+ y MariaDB 10.6+. Se puede correr más de una vez.
-- =====================================================================

USE aalcuadrado;

-- Fotos de kits: nueva categoría. MODIFY con la lista completa es idempotente.
ALTER TABLE imagenes
  MODIFY COLUMN categoria ENUM('productos', 'galeria', 'kits') NOT NULL;

CREATE TABLE IF NOT EXISTS kit_colores (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(60)   NOT NULL,
  hex             VARCHAR(7)    NOT NULL COMMENT '#RRGGBB',
  en_jabon        TINYINT(1)    NOT NULL DEFAULT 1,
  en_vela         TINYINT(1)    NOT NULL DEFAULT 1,
  disponible      TINYINT(1)    NOT NULL DEFAULT 1,
  orden           INT           NOT NULL DEFAULT 0,
  creado_en       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_kit_colores_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kit_aromas (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(60)   NOT NULL,
  en_jabon        TINYINT(1)    NOT NULL DEFAULT 1,
  en_vela         TINYINT(1)    NOT NULL DEFAULT 1,
  disponible      TINYINT(1)    NOT NULL DEFAULT 1,
  orden           INT           NOT NULL DEFAULT 0,
  creado_en       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_kit_aromas_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Las opciones que el front tenía fijas en src/config/sitio.ts. INSERT IGNORE:
-- si ya existe un color o aroma con ese nombre, no se toca.
INSERT IGNORE INTO kit_colores (nombre, hex, en_jabon, en_vela, orden) VALUES
  ('Rojo navidad',  '#B3202A', 1, 1, 0),
  ('Verde pino',    '#1F5E3B', 1, 1, 1),
  ('Blanco nieve',  '#F4EFE6', 1, 0, 2),
  ('Blanco',        '#F4EFE6', 0, 1, 3),
  ('Dorado',        '#C9A227', 1, 1, 4),
  ('Rosa mexicano', '#E4007C', 1, 0, 5);

INSERT IGNORE INTO kit_aromas (nombre, en_jabon, en_vela, orden) VALUES
  ('Canela',              1, 1, 0),
  ('Vainilla',            1, 1, 1),
  ('Pino',                1, 1, 2),
  ('Naranja y clavo',     1, 0, 3),
  ('Lavanda',             1, 0, 4),
  ('Manzana con canela',  0, 1, 5),
  ('Galleta de jengibre', 0, 1, 6);

-- Después de correr esto, dale permisos al usuario de la API con database/02_crear_usuario_bd.sql
-- (ya incluye el GRANT de `kit_colores` y `kit_aromas`; se puede volver a correr sin problema).
