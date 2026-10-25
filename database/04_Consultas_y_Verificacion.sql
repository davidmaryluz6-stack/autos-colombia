-- Consultas de verificacion. Ejecutar tras 01, 02 y 03.
USE autos_colombia;
-- 1) Tablas y estructura
SHOW TABLES;
SHOW CREATE TABLE movimientos;
-- 2) Disponibilidad de celdas: siempre derivada de movimientos ACTIVO
SELECT * FROM v_celdas_ocupacion ORDER BY codigo;
-- 3) Vehiculos presentes
SELECT m.id, v.placa, c.codigo AS celda, m.fecha_entrada_utc, u.usuario AS operador
FROM movimientos m JOIN vehiculos v ON v.id = m.vehiculo_id
JOIN celdas c ON c.id = m.celda_id
JOIN usuarios u ON u.id = m.usuario_entrada_id
WHERE m.estado = 'ACTIVO' ORDER BY m.fecha_entrada_utc DESC;
-- 4) Historial completo con duracion en minutos para salidas finalizadas
SELECT m.id, v.placa, c.codigo AS celda, m.estado, m.fecha_entrada_utc,
       m.fecha_salida_utc,
       CASE WHEN m.fecha_salida_utc IS NULL THEN NULL
            ELSE TIMESTAMPDIFF(MINUTE, m.fecha_entrada_utc, m.fecha_salida_utc)
       END AS minutos_permanencia
FROM movimientos m JOIN vehiculos v ON v.id = m.vehiculo_id
JOIN celdas c ON c.id = m.celda_id ORDER BY m.id DESC;
-- 5) Indicadores del panel
SELECT (SELECT COUNT(*) FROM celdas WHERE habilitada = 1) AS celdas_habilitadas,
       (SELECT COUNT(*) FROM movimientos WHERE estado = 'ACTIVO') AS ocupadas,
       (SELECT COUNT(*) FROM v_celdas_ocupacion WHERE estado_ocupacion = 'DISPONIBLE') AS disponibles,
       (SELECT COUNT(*) FROM movimientos WHERE fecha_entrada_utc >= UTC_DATE()) AS ingresos_hoy_utc;
-- 6) Novedades y auditabilidad
SELECT n.id, v.placa, n.tipo, n.descripcion, u.usuario, n.fecha_utc
FROM novedades n JOIN movimientos m ON m.id = n.movimiento_id
JOIN vehiculos v ON v.id = m.vehiculo_id
JOIN usuarios u ON u.id = n.usuario_id ORDER BY n.fecha_utc DESC;
SELECT * FROM auditoria ORDER BY fecha_utc DESC;
-- 7) PRUEBAS MANUALES OPCIONALES (descomentar una a una)
-- CALL sp_registrar_entrada('ABC123','C-002',2,@intento); -- DEBE FALLAR: ingreso duplicado
-- CALL sp_registrar_entrada('FRT905','C-001',2,@intento); -- DEBE FALLAR: celda ocupada
-- CALL sp_registrar_entrada('EXP111','C-002',2,@intento); -- DEBE FALLAR: mensualidad vencida
-- CALL sp_registrar_salida(@id_mov_1,2);                  -- DEBE FINALIZAR Y LIBERAR C-001
-- CALL sp_registrar_salida(@id_mov_1,2);                  -- DEBE FALLAR: salida duplicada
