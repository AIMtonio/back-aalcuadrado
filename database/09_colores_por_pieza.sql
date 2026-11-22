-- =====================================================================
-- aalcuadrado · 09. Colores separados por pieza (jabón y vela)
-- Crea la tabla `colores`, con una lista para el jabón y otra para la vela
-- (la vela del kit y las velas individuales), y pasa ahí los colores de
-- `kit_colores`: uno marcado para jabón y vela queda en las dos listas.
-- `kit_colores` no se borra (la API ya no la usa); bórrala cuando revises
-- que todo quedó bien:  DROP TABLE kit_colores;
-- Ejecutar con un usuario administrador (root):
--   sudo mysql < database/09_colores_por_pieza.sql
-- Compatible con MySQL 8+ y MariaDB 10.6+. Se puede correr más de una vez.
-- =====================================================================

USE aalcuadrado;

CREATE TABLE IF NOT EXISTS colores (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  pieza           ENUM('jabon', 'vela') NOT NULL,
  nombre          VARCHAR(60)   NOT NULL,
  hex             VARCHAR(7)    NOT NULL COMMENT '#RRGGBB',
  disponible      TINYINT(1)    NOT NULL DEFAULT 1,
  orden           INT           NOT NULL DEFAULT 0,
  creado_en       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_colores_pieza_nombre (pieza, nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copia de kit_colores, solo si existe (SQL dinámico: si no existe, nombrarla daría error).
-- INSERT IGNORE: lo que ya esté en `colores` (misma pieza y nombre) no se toca.
SET @existe_tabla := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kit_colores'
);
SET @sql := IF(@existe_tabla = 1,
  'INSERT IGNORE INTO colores (pieza, nombre, hex, disponible, orden)
     SELECT ''jabon'', nombre, hex, disponible, orden FROM kit_colores WHERE en_jabon = 1
     UNION ALL
     SELECT ''vela'', nombre, hex, disponible, orden FROM kit_colores WHERE en_vela = 1',
  'SELECT 1');
PREPARE copiar_colores FROM @sql;
EXECUTE copiar_colores;
DEALLOCATE PREPARE copiar_colores;

-- Después de correr esto, dale permisos al usuario de la API con database/02_crear_usuario_bd.sql
-- (ya incluye el GRANT de `colores`; se puede volver a correr sin problema).
