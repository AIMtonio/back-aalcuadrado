-- =====================================================================
-- aalcuadrado · 07. Velas individuales personalizadas
-- Para una base que ya existe: agrega las categorías de fotos de velas,
-- crea las tablas de presentaciones y de pedidos de velas, y carga las
-- presentaciones iniciales. En una instalación nueva las tablas ya existen
-- (01) y solo se cargan las presentaciones.
-- Ejecutar con un usuario administrador (root):
--   sudo mysql < database/07_velas.sql
-- Compatible con MySQL 8+ y MariaDB 10.6+. Se puede correr más de una vez.
-- =====================================================================

USE aalcuadrado;

-- Fotos de cada tipo de vela: nuevas categorías. MODIFY con la lista completa es idempotente.
ALTER TABLE imagenes
  MODIFY COLUMN categoria ENUM('productos', 'galeria', 'kits', 'velas-recipiente', 'velas-molde', 'velas-jicara') NOT NULL;

-- Velas individuales personalizadas (pestaña Velas del panel). Cada tipo tiene sus
-- presentaciones: tamaños (recipiente, jícara) o moldes (molde). `gramos` queda en NULL
-- hasta que se defina. En jícara el marmoleado no se ofrece (no se apreciaría).
CREATE TABLE IF NOT EXISTS velas_presentaciones (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  tipo            ENUM('recipiente', 'molde', 'jicara') NOT NULL,
  nombre          VARCHAR(40)   NOT NULL COMMENT 'Pequeña, Mediana, Grande o el molde (Cupcake)',
  gramos          INT UNSIGNED  NULL     COMMENT 'Gramos de cera; NULL = pendiente',
  marmoleable     TINYINT(1)    NOT NULL DEFAULT 0,
  disponible      TINYINT(1)    NOT NULL DEFAULT 1,
  orden           INT           NOT NULL DEFAULT 0,
  creado_en       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  actualizado_en  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_velas_presentaciones_tipo_nombre (tipo, nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pedidos de velas que llegan desde el front. Guardan los nombres elegidos (no ids) y los
-- gramos que tenía la presentación. Los cotiza el dueño a mano (pestaña Pedidos del panel).
CREATE TABLE IF NOT EXISTS pedidos_velas (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  cliente_nombre    VARCHAR(100)  NOT NULL,
  cliente_contacto  VARCHAR(150)  NOT NULL COMMENT 'Correo o teléfono de quien pidió',
  tipo              ENUM('recipiente', 'molde', 'jicara') NOT NULL,
  presentacion      VARCHAR(40)   NOT NULL,
  gramos            INT UNSIGNED  NULL,
  color             VARCHAR(60)   NOT NULL,
  aroma             VARCHAR(60)   NOT NULL,
  topping           VARCHAR(60)   NOT NULL,
  marmoleado        TINYINT(1)    NOT NULL DEFAULT 0,
  color_marmoleado  VARCHAR(60)   NULL,
  cantidad          INT UNSIGNED  NOT NULL DEFAULT 1,
  notas             VARCHAR(500)  NULL,
  creado_en         DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_pedidos_velas_creado_en (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Presentaciones iniciales. INSERT IGNORE: si ya existe ese tipo + nombre, no se toca
-- (así no se pierden los gramos que hayas puesto). Los gramos quedan pendientes (NULL).
INSERT IGNORE INTO velas_presentaciones (tipo, nombre, marmoleable, orden) VALUES
  ('recipiente', 'Pequeña', 1, 0),
  ('recipiente', 'Mediana', 1, 1),
  ('recipiente', 'Grande',  1, 2),
  ('molde',      'Cupcake', 0, 0),
  ('jicara',     'Pequeña', 0, 0),
  ('jicara',     'Mediana', 0, 1),
  ('jicara',     'Grande',  0, 2);

-- Para poner los gramos (o hazlo desde la pestaña Velas del panel):
--   UPDATE velas_presentaciones SET gramos = 180 WHERE tipo = 'recipiente' AND nombre = 'Mediana';

-- Después de correr esto, dale permisos al usuario de la API con database/02_crear_usuario_bd.sql
-- (ya incluye el GRANT de `velas_presentaciones` y `pedidos_velas`; se puede volver a correr sin problema).
