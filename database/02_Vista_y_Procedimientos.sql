-- Ejecutar DESPUES de 01_Modelo_Fisico_MySQL8_DDL.sql.
-- Logica transaccional; todas las fechas se almacenan en UTC.
USE autos_colombia;

CREATE OR REPLACE VIEW v_celdas_ocupacion AS
SELECT c.id, c.codigo, c.tipo, c.habilitada,
       CASE WHEN m.id IS NOT NULL THEN 'OCUPADA'
            WHEN c.habilitada = 0 THEN 'INHABILITADA'
            ELSE 'DISPONIBLE' END AS estado_ocupacion,
       m.id AS movimiento_activo_id,
       v.placa AS placa_actual
FROM celdas c
LEFT JOIN movimientos m ON m.celda_id = c.id AND m.estado = 'ACTIVO'
LEFT JOIN vehiculos v ON v.id = m.vehiculo_id;

DROP PROCEDURE IF EXISTS sp_registrar_entrada;
DELIMITER $$
CREATE PROCEDURE sp_registrar_entrada (
  IN p_placa VARCHAR(10), IN p_codigo_celda VARCHAR(16),
  IN p_usuario_id BIGINT UNSIGNED, OUT p_movimiento_id BIGINT UNSIGNED
)
BEGIN
  DECLARE v_vehiculo_id BIGINT UNSIGNED DEFAULT NULL;
  DECLARE v_celda_id BIGINT UNSIGNED DEFAULT NULL;
  DECLARE v_autorizado TINYINT DEFAULT 0;
  DECLARE v_cliente_activo TINYINT DEFAULT 0;
  DECLARE v_hasta DATE DEFAULT NULL;
  DECLARE v_celda_habilitada TINYINT DEFAULT 0;
  DECLARE v_usuario_activo TINYINT DEFAULT 0;
  DECLARE v_rol VARCHAR(12) DEFAULT NULL;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  SET p_movimiento_id = NULL;
  START TRANSACTION;
  SELECT v.id, v.autorizado, c.activo, v.autorizacion_hasta
    INTO v_vehiculo_id, v_autorizado, v_cliente_activo, v_hasta
  FROM vehiculos v INNER JOIN clientes c ON c.id = v.cliente_id
  WHERE v.placa = UPPER(TRIM(p_placa)) FOR UPDATE;
  IF v_vehiculo_id IS NULL OR v_autorizado <> 1 OR v_cliente_activo <> 1
     OR v_hasta < UTC_DATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Vehiculo o mensualidad no autorizados';
  END IF;
  SELECT id, habilitada INTO v_celda_id, v_celda_habilitada
    FROM celdas WHERE codigo = UPPER(TRIM(p_codigo_celda)) FOR UPDATE;
  IF v_celda_id IS NULL OR v_celda_habilitada <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Celda inexistente o inhabilitada';
  END IF;
  SELECT rol, activo INTO v_rol, v_usuario_activo FROM usuarios
    WHERE id = p_usuario_id FOR UPDATE;
  IF v_rol IS NULL OR v_usuario_activo <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operador no habilitado';
  END IF;
  IF EXISTS (SELECT 1 FROM movimientos WHERE vehiculo_id = v_vehiculo_id AND estado = 'ACTIVO') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Vehiculo ya tiene una entrada activa';
  END IF;
  IF EXISTS (SELECT 1 FROM movimientos WHERE celda_id = v_celda_id AND estado = 'ACTIVO') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Celda ocupada';
  END IF;
  -- Los indices UNIQUE sobre las columnas generadas protegen contra simultaneidad.
  INSERT INTO movimientos (vehiculo_id, celda_id, usuario_entrada_id, fecha_entrada_utc, estado)
    VALUES (v_vehiculo_id, v_celda_id, p_usuario_id, UTC_TIMESTAMP(), 'ACTIVO');
  SET p_movimiento_id = LAST_INSERT_ID();
  INSERT INTO auditoria (usuario_id, accion, entidad, registro_id, detalles)
    VALUES (p_usuario_id, 'REGISTRAR_ENTRADA', 'movimientos', p_movimiento_id,
      JSON_OBJECT('placa', UPPER(TRIM(p_placa)), 'celda', UPPER(TRIM(p_codigo_celda))));
  COMMIT;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_registrar_salida;
DELIMITER $$
CREATE PROCEDURE sp_registrar_salida (
  IN p_movimiento_id BIGINT UNSIGNED, IN p_usuario_id BIGINT UNSIGNED
)
BEGIN
  DECLARE v_estado VARCHAR(15) DEFAULT NULL;
  DECLARE v_fecha DATETIME DEFAULT NULL;
  DECLARE v_usuario_activo TINYINT DEFAULT NULL;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  SELECT estado, fecha_entrada_utc INTO v_estado, v_fecha
    FROM movimientos WHERE id = p_movimiento_id FOR UPDATE;
  IF v_estado IS NULL OR v_estado <> 'ACTIVO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe una permanencia activa';
  END IF;
  SELECT activo INTO v_usuario_activo FROM usuarios WHERE id = p_usuario_id;
  IF v_usuario_activo IS NULL OR v_usuario_activo <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operador no habilitado';
  END IF;
  UPDATE movimientos SET estado = 'FINALIZADO', fecha_salida_utc = GREATEST(UTC_TIMESTAMP(), v_fecha),
    usuario_salida_id = p_usuario_id WHERE id = p_movimiento_id;
  INSERT INTO auditoria (usuario_id, accion, entidad, registro_id, detalles)
    VALUES (p_usuario_id, 'REGISTRAR_SALIDA', 'movimientos', p_movimiento_id,
      JSON_OBJECT('liberacion_celda', 'automatica_por_ausencia_de_movimiento_activo'));
  COMMIT;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_registrar_novedad;
DELIMITER $$
CREATE PROCEDURE sp_registrar_novedad (
 IN p_movimiento_id BIGINT UNSIGNED, IN p_usuario_id BIGINT UNSIGNED,
 IN p_tipo VARCHAR(20), IN p_descripcion TEXT
)
BEGIN
 DECLARE v_mov_activo INT DEFAULT 0;
 DECLARE v_user_activo INT DEFAULT 0;
 DECLARE v_novedad_id BIGINT UNSIGNED;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 START TRANSACTION;
 SELECT COUNT(*) INTO v_mov_activo FROM movimientos
  WHERE id = p_movimiento_id AND estado = 'ACTIVO';
 SELECT COUNT(*) INTO v_user_activo FROM usuarios
  WHERE id = p_usuario_id AND activo = 1;
 IF v_mov_activo <> 1 OR v_user_activo <> 1 THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Movimiento u operador no valido';
 END IF;
 IF p_descripcion IS NULL OR CHAR_LENGTH(TRIM(p_descripcion)) = 0 THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Descripcion requerida';
 END IF;
 INSERT INTO novedades (movimiento_id, usuario_id, tipo, descripcion)
   VALUES (p_movimiento_id, p_usuario_id, p_tipo, p_descripcion);
 SET v_novedad_id = LAST_INSERT_ID();
 INSERT INTO auditoria (usuario_id, accion, entidad, registro_id, detalles)
   VALUES (p_usuario_id, 'REGISTRAR_NOVEDAD', 'novedades', v_novedad_id,
     JSON_OBJECT('movimiento_id', p_movimiento_id));
 COMMIT;
END$$
DELIMITER ;
