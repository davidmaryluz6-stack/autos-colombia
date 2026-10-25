-- Datos FICTICIOS de demostracion. Ejecutar tras los scripts 01 y 02.
-- Credenciales para pruebas locales: operador / Demo2026! (NO usar en produccion).
-- Evitar reejecutar: inserciones de prueba diseñadas para una base vacia.
USE autos_colombia;
INSERT INTO usuarios (nombre, usuario, contrasena_hash, rol) VALUES
 ('Administrador Demo', 'administrador', '$2b$12$aJginlTNiz.4dqF/yWs1MuweZOa23odBU.P.oc1.Sipr13nF4jMAS', 'ADMIN'),
 ('Operador Demo', 'operador', '$2b$12$aJginlTNiz.4dqF/yWs1MuweZOa23odBU.P.oc1.Sipr13nF4jMAS', 'OPERADOR');
INSERT INTO clientes (nombre, documento, telefono, correo) VALUES
 ('Cliente Uno (ficticio)', 'DOC-001', '3000000001', 'cliente1@example.test'),
 ('Cliente Dos (ficticio)', 'DOC-002', '3000000002', 'cliente2@example.test'),
 ('Cliente Tres (ficticio)', 'DOC-003', NULL, NULL);
INSERT INTO vehiculos (cliente_id, placa, tipo, color, autorizado, autorizacion_hasta) VALUES
 (1, 'ABC123', 'AUTOMOVIL', 'Gris', 1, DATE_ADD(UTC_DATE(), INTERVAL 90 DAY)),
 (2, 'HKL482', 'MOTOCICLETA', 'Negro', 1, DATE_ADD(UTC_DATE(), INTERVAL 90 DAY)),
 (3, 'FRT905', 'AUTOMOVIL', 'Azul', 1, DATE_ADD(UTC_DATE(), INTERVAL 90 DAY)),
 (3, 'EXP111', 'CAMIONETA', 'Blanco', 1, DATE_SUB(UTC_DATE(), INTERVAL 1 DAY));
INSERT INTO celdas (codigo, tipo, habilitada) VALUES
 ('C-001', 'MIXTA', 1), ('C-002', 'MIXTA', 1),
 ('C-003', 'MOTOCICLETA', 1), ('C-004', 'MIXTA', 1),
 ('C-005', 'MIXTA', 0);
-- Dos ingresos simulados, coherentes con los estados visibles en el prototipo.
CALL sp_registrar_entrada('ABC123', 'C-001', 2, @id_mov_1);
CALL sp_registrar_entrada('HKL482', 'C-003', 2, @id_mov_2);
CALL sp_registrar_novedad(@id_mov_1, 2, 'OBSERVACION',
 'Observacion ficticia durante el ingreso del vehiculo.');
SELECT @id_mov_1 AS primer_movimiento, @id_mov_2 AS segundo_movimiento;
