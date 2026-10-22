-- =====================================================================
-- aalcuadrado · 01. Base de datos y tablas
-- Ejecutar con un usuario administrador (root):
--   sudo mysql < database/01_crear_base_de_datos.sql
-- Compatible con MySQL 8+ y MariaDB 10.6+. Se puede correr más de una vez.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS aalcuadrado
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE aalcuadrado;

-- Usuarios que pueden entrar al panel. Por ahora, solo uno.
CREATE TABLE IF NOT EXISTS usuarios (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  usuario         VARCHAR(50)   NOT NULL,
  password_hash   VARCHAR(100)  NOT NULL COMMENT 'Hash bcrypt, nunca la contraseña',
  activo          TINYINT(1)    NOT NULL DEFAULT 1,
  ultimo_acceso   DATETIME      NULL,
  creado_en       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fotos subidas desde el panel. El archivo vive en UPLOADS_DIR/<categoria>/<archivo>.
CREATE TABLE IF NOT EXISTS imagenes (
  id               INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  categoria        ENUM('productos', 'galeria') NOT NULL,
  archivo          VARCHAR(120)   NOT NULL COMMENT 'Nombre en disco, lo genera la API',
  nombre_original  VARCHAR(255)   NOT NULL,
  mime             VARCHAR(20)    NOT NULL,
  tamano_bytes     INT UNSIGNED   NOT NULL,
  alt              VARCHAR(200)   NULL     COMMENT 'Texto alternativo',
  producto         VARCHAR(100)   NULL     COMMENT 'Slug del producto en el front',
  color            VARCHAR(50)    NULL     COMMENT 'Id del color en el front',
  orden            INT            NOT NULL DEFAULT 0,
  creado_en        DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en   DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_imagenes_archivo (archivo),
  KEY idx_imagenes_categoria_producto (categoria, producto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
