-- =====================================================================
-- aalcuadrado · 03. Productos iniciales
-- Carga los productos que hoy están en el front (src/content/productos/*.json)
-- para que sus fotos y enlaces sigan funcionando al pasar el catálogo a la API.
--
-- Ejecutar con un usuario administrador, DESPUÉS de los scripts 01 y 02:
--   sudo mariadb < database/03_productos_iniciales.sql
-- Se puede correr más de una vez: no duplica ni pisa productos que ya existan.
-- =====================================================================

USE aalcuadrado;

INSERT IGNORE INTO productos (slug, nombre, coleccion, descripcion, etiqueta, precio, disponible, destacado, orden) VALUES
  ('papel-picado-calaverita', 'Papel picado calaverita', 'dia-de-muertos',
   'Una calaverita calada como el papel picado de las ofrendas, pero que no se rompe ni se arruga.',
   'Temporada', 120.00, 1, 1, 1),
  ('corazon-talavera', 'Corazón de talavera', 'mexicanos',
   'El trazo de la talavera poblana en un corazón ligero, para usar todos los días.',
   'Nuevo', 150.00, 1, 0, 2),
  ('nochebuena', 'Nochebuena', 'navidad',
   'La flor de diciembre, en capas que se notan cuando les da la luz.',
   NULL, 130.00, 0, 0, 3);

INSERT IGNORE INTO producto_colores (producto_id, color_id, nombre, hex, orden)
SELECT p.id, c.color_id, c.nombre, c.hex, c.orden
FROM (
            SELECT 'papel-picado-calaverita' AS slug, 'morado'        AS color_id, 'Morado'        AS nombre, '#3B2A9B' AS hex, 0 AS orden
  UNION ALL SELECT 'papel-picado-calaverita',         'rosa-mexicano',             'Rosa mexicano',            '#E4007C',        1
  UNION ALL SELECT 'corazon-talavera',                'azul-cobalto',              'Azul cobalto',             '#1F3FAE',        0
  UNION ALL SELECT 'corazon-talavera',                'amarillo',                  'Amarillo',                 '#F2B705',        1
  UNION ALL SELECT 'nochebuena',                      'rojo',                      'Rojo',                     '#C8102E',        0
) AS c
JOIN productos p ON p.slug COLLATE utf8mb4_unicode_ci = c.slug COLLATE utf8mb4_unicode_ci;

-- Revisa el resultado:
--   SELECT p.slug, p.nombre, GROUP_CONCAT(c.color_id ORDER BY c.orden) AS colores
--   FROM productos p LEFT JOIN producto_colores c ON c.producto_id = p.id GROUP BY p.id;
