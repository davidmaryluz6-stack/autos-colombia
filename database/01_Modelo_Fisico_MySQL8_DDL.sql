-- PROYECTO: AUTOS COLOMBIA / ITERACION 1
-- PUNTO 5: MODELO FISICO MySQL 8.0.16+ / MySQL Workbench
-- Fuente: elaboracion academica. Datos ilustrativos.
-- Ejecutar este archivo primero. No incluye datos de prueba.
CREATE DATABASE IF NOT EXISTS autos_colombia
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE autos_colombia;

CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(120) NOT NULL,
    usuario VARCHAR(60) NOT NULL,
    contrasena_hash VARCHAR(255) NOT NULL,
    rol ENUM('ADMIN','OPERADOR') NOT NULL DEFAULT 'OPERADOR',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_utc DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_usuario (usuario),
    CONSTRAINT ck_usuarios_activo CHECK (activo IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clientes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(120) NOT NULL,
    documento VARCHAR(25) NOT NULL,
    telefono VARCHAR(25) NULL,
    correo VARCHAR(120) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_clientes_documento (documento),
    CONSTRAINT ck_clientes_activo CHECK (activo IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehiculos (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    cliente_id BIGINT UNSIGNED NOT NULL,
    placa VARCHAR(10) NOT NULL,
    tipo ENUM('AUTOMOVIL','MOTOCICLETA','CAMIONETA','OTRO') NOT NULL,
    color VARCHAR(35) NULL,
    autorizado TINYINT(1) NOT NULL DEFAULT 1,
    autorizacion_hasta DATE NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vehiculos_placa (placa),
    KEY ix_vehiculos_cliente (cliente_id),
    CONSTRAINT fk_vehiculos_cliente FOREIGN KEY (cliente_id)
        REFERENCES clientes (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_vehiculos_autorizado CHECK (autorizado IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS celdas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo VARCHAR(16) NOT NULL,
    tipo ENUM('AUTOMOVIL','MOTOCICLETA','MIXTA') NOT NULL DEFAULT 'MIXTA',
    habilitada TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_celdas_codigo (codigo),
    CONSTRAINT ck_celdas_habilitada CHECK (habilitada IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS movimientos (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    vehiculo_id BIGINT UNSIGNED NOT NULL,
    celda_id BIGINT UNSIGNED NOT NULL,
    usuario_entrada_id BIGINT UNSIGNED NOT NULL,
    usuario_salida_id BIGINT UNSIGNED NULL,
    fecha_entrada_utc DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
    fecha_salida_utc DATETIME NULL,
    estado ENUM('ACTIVO','FINALIZADO') NOT NULL DEFAULT 'ACTIVO',
    -- Solo filas activas reciben valor; UNIQUE permite varios NULL historicos.
    vehiculo_activo_id BIGINT UNSIGNED GENERATED ALWAYS AS
        (CASE WHEN estado = 'ACTIVO' THEN vehiculo_id ELSE NULL END) STORED,
    celda_activa_id BIGINT UNSIGNED GENERATED ALWAYS AS
        (CASE WHEN estado = 'ACTIVO' THEN celda_id ELSE NULL END) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_mov_vehiculo_activo (vehiculo_activo_id),
    UNIQUE KEY uq_mov_celda_activa (celda_activa_id),
    KEY ix_mov_vehiculo_fecha (vehiculo_id, fecha_entrada_utc),
    KEY ix_mov_celda (celda_id),
    KEY ix_mov_usuario_entrada (usuario_entrada_id),
    KEY ix_mov_usuario_salida (usuario_salida_id),
    KEY ix_mov_fecha (fecha_entrada_utc),
    CONSTRAINT fk_mov_vehiculo FOREIGN KEY (vehiculo_id)
        REFERENCES vehiculos(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_mov_celda FOREIGN KEY (celda_id)
        REFERENCES celdas(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_mov_usuario_entrada FOREIGN KEY (usuario_entrada_id)
        REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_mov_usuario_salida FOREIGN KEY (usuario_salida_id)
        REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_mov_estado_fechas CHECK (
       (estado = 'ACTIVO' AND fecha_salida_utc IS NULL AND usuario_salida_id IS NULL)
       OR (estado = 'FINALIZADO' AND fecha_salida_utc IS NOT NULL
           AND usuario_salida_id IS NOT NULL AND fecha_salida_utc >= fecha_entrada_utc)
    )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS novedades (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    movimiento_id BIGINT UNSIGNED NOT NULL,
    usuario_id BIGINT UNSIGNED NOT NULL,
    tipo ENUM('OBSERVACION','INCIDENTE','ACCESO','OTRO') NOT NULL DEFAULT 'OBSERVACION',
    descripcion TEXT NOT NULL,
    fecha_utc DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (id),
    KEY ix_novedades_mov (movimiento_id),
    KEY ix_novedades_usuario (usuario_id),
    CONSTRAINT fk_nov_mov FOREIGN KEY (movimiento_id)
        REFERENCES movimientos(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_nov_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auditoria (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id BIGINT UNSIGNED NOT NULL,
    accion VARCHAR(50) NOT NULL,
    entidad VARCHAR(50) NOT NULL,
    registro_id BIGINT UNSIGNED NOT NULL,
    detalles JSON NULL,
    fecha_utc DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (id),
    KEY ix_auditoria_usuario (usuario_id),
    KEY ix_auditoria_fecha (fecha_utc),
    KEY ix_auditoria_referencia (entidad, registro_id),
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB;
