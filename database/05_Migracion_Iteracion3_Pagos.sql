-- PROYECTO: AUTOS COLOMBIA / ITERACION 3 - GESTION DE PAGOS
-- Migracion incremental e idempotente (CREATE TABLE IF NOT EXISTS). Ejecutar DESPUES de 01 y 02.
-- No modifica ni elimina datos de las iteraciones 1 y 2.
USE autos_colombia;

CREATE TABLE IF NOT EXISTS pagos (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    cliente_id BIGINT UNSIGNED NOT NULL,
    vehiculo_id BIGINT UNSIGNED NOT NULL,
    periodo DATE NOT NULL COMMENT 'Primer dia del mes pagado',
    valor DECIMAL(12,2) NOT NULL,
    metodo ENUM('EFECTIVO','TRANSFERENCIA','TARJETA','OTRO') NOT NULL,
    referencia VARCHAR(60) NULL,
    observacion VARCHAR(255) NULL,
    estado ENUM('REGISTRADO','ANULADO') NOT NULL DEFAULT 'REGISTRADO',
    fecha_pago_utc DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
    usuario_id BIGINT UNSIGNED NOT NULL,
    motivo_anulacion VARCHAR(255) NULL,
    fecha_anulacion_utc DATETIME NULL,
    usuario_anulacion_id BIGINT UNSIGNED NULL,
    -- Solo pagos REGISTRADOS participan en los UNIQUE: un periodo anulado puede pagarse de nuevo.
    periodo_activo_clave VARCHAR(40) GENERATED ALWAYS AS
        (CASE WHEN estado = 'REGISTRADO' THEN CONCAT(vehiculo_id, '|', periodo) ELSE NULL END) STORED,
    referencia_activa_clave VARCHAR(80) GENERATED ALWAYS AS
        (CASE WHEN estado = 'REGISTRADO' AND referencia IS NOT NULL
              THEN CONCAT(metodo, '|', referencia) ELSE NULL END) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pagos_periodo_activo (periodo_activo_clave),
    UNIQUE KEY uq_pagos_referencia_activa (referencia_activa_clave),
    KEY ix_pagos_cliente (cliente_id),
    KEY ix_pagos_vehiculo_periodo (vehiculo_id, periodo),
    KEY ix_pagos_fecha (fecha_pago_utc),
    KEY ix_pagos_usuario (usuario_id),
    CONSTRAINT fk_pagos_cliente FOREIGN KEY (cliente_id)
        REFERENCES clientes(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_pagos_vehiculo FOREIGN KEY (vehiculo_id)
        REFERENCES vehiculos(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_pagos_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_pagos_usuario_anulacion FOREIGN KEY (usuario_anulacion_id)
        REFERENCES usuarios(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_pagos_valor CHECK (valor > 0),
    CONSTRAINT ck_pagos_periodo_dia1 CHECK (DAY(periodo) = 1),
    CONSTRAINT ck_pagos_anulacion CHECK (
        (estado = 'REGISTRADO' AND fecha_anulacion_utc IS NULL AND usuario_anulacion_id IS NULL AND motivo_anulacion IS NULL)
        OR (estado = 'ANULADO' AND fecha_anulacion_utc IS NOT NULL AND usuario_anulacion_id IS NOT NULL AND motivo_anulacion IS NOT NULL)
    )
) ENGINE=InnoDB;
