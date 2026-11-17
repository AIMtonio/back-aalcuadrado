-- =====================================================================
-- aalcuadrado · 08. Precios de velas
-- Para una base que ya existe: agrega `precio` a cada presentación de vela
-- y `precio_unitario` a los pedidos de velas (el precio que tenía la
-- presentación al pedir). En una instalación nueva (01) ya existen.
-- Ejecutar con un usuario administrador (root):
--   sudo mysql < database/08_precios_velas.sql
-- Compatible con MySQL 8+ y MariaDB 10.6+. Se puede correr más de una vez.
-- =====================================================================

USE aalcuadrado;

-- SQL dinámico porque MySQL 8 no soporta "ADD COLUMN IF NOT EXISTS".
SET @existe_columna := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'velas_presentaciones' AND COLUMN_NAME = 'precio'
);
SET @sql := IF(@existe_columna = 0,
  'ALTER TABLE velas_presentaciones
     ADD COLUMN precio DECIMAL(8, 2) NULL COMMENT ''Precio de una vela; NULL = pendiente'' AFTER gramos',
  'SELECT 1');
PREPARE agregar_precio FROM @sql;
EXECUTE agregar_precio;
DEALLOCATE PREPARE agregar_precio;

SET @existe_columna := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos_velas' AND COLUMN_NAME = 'precio_unitario'
);
SET @sql := IF(@existe_columna = 0,
  'ALTER TABLE pedidos_velas
     ADD COLUMN precio_unitario DECIMAL(8, 2) NULL COMMENT ''Precio de la presentación al pedir; NULL = no tenía'' AFTER cantidad',
  'SELECT 1');
PREPARE agregar_precio_unitario FROM @sql;
EXECUTE agregar_precio_unitario;
DEALLOCATE PREPARE agregar_precio_unitario;

-- Para poner un precio (o hazlo desde la pestaña Velas del panel):
--   UPDATE velas_presentaciones SET precio = 150.00 WHERE tipo = 'recipiente' AND nombre = 'Mediana';

-- No hacen falta permisos nuevos: las tablas ya tenían su GRANT (02_crear_usuario_bd.sql).
