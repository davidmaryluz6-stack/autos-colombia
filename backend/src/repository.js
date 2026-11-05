import {pool} from './db.js';
import {UserError, validarCambioCeldaOcupada} from './validation.js';

export async function obtenerUsuario(usuario) {
  const [[row]] = await pool.execute(
    'SELECT id,nombre,usuario,contrasena_hash,rol,activo FROM usuarios WHERE usuario=? LIMIT 1',
    [usuario]
  );
  return row || null;
}

export async function usuarioActivo(id) {
  const [[row]] = await pool.execute(
    'SELECT id,nombre,usuario,rol FROM usuarios WHERE id=? AND activo=1 LIMIT 1',
    [id]
  );
  return row || null;
}

export async function listarUsuarios({q = '', rol = '', activo = ''} = {}) {
  const where = [];
  const params = [];
  const texto = String(q || '').trim();
  if (texto) {
    where.push('(nombre LIKE ? OR usuario LIKE ?)');
    params.push(`%${texto}%`, `%${texto}%`);
  }
  if (rol) {
    where.push('rol = ?');
    params.push(String(rol).toUpperCase());
  }
  if (activo !== '' && activo !== null && activo !== undefined) {
    where.push('activo = ?');
    params.push(Number(activo) ? 1 : 0);
  }
  const [rows] = await pool.execute(
    `SELECT id, nombre, usuario, rol, activo, creado_utc
     FROM usuarios
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY activo DESC, rol ASC, nombre ASC, id ASC`,
    params
  );
  return rows;
}

export async function crearUsuario({nombre, usuario, contrasenaHash, rol, activo, adminId}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[existente]] = await conn.execute(
      'SELECT id FROM usuarios WHERE usuario = ? LIMIT 1 FOR UPDATE',
      [usuario]
    );
    if (existente) {
      throw new UserError('El usuario de acceso ya está registrado.', 409);
    }
    const [result] = await conn.execute(
      `INSERT INTO usuarios (nombre, usuario, contrasena_hash, rol, activo)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre, usuario, contrasenaHash, rol, activo]
    );
    await conn.execute(
      `INSERT INTO auditoria (usuario_id, accion, entidad, registro_id, detalles)
       VALUES (?, 'CREAR_USUARIO', 'usuarios', ?, JSON_OBJECT(
         'usuario', ?, 'nombre', ?, 'rol', ?, 'activo', ?
       ))`,
      [adminId, result.insertId, usuario, nombre, rol, activo]
    );
    await conn.commit();
    return {
      id: result.insertId,
      nombre,
      usuario,
      rol,
      activo,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function actualizarUsuario(id, cambios, adminId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[actual]] = await conn.execute(
      'SELECT id, nombre, usuario, rol, activo, creado_utc FROM usuarios WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!actual) {
      throw new UserError('La cuenta de usuario no existe.', 404);
    }
    const nuevoNombre = cambios.nombre ?? actual.nombre;
    const nuevoRol = cambios.rol ?? actual.rol;
    const nuevoActivo = cambios.activo ?? actual.activo;

    if (actual.rol === 'ADMIN' && actual.activo === 1 && (nuevoRol !== 'ADMIN' || nuevoActivo !== 1)) {
      const [otrosAdmins] = await conn.execute(
        "SELECT id FROM usuarios WHERE rol = 'ADMIN' AND activo = 1 AND id <> ? FOR UPDATE",
        [id]
      );
      if (!otrosAdmins.length) {
        throw new UserError('No se puede desactivar ni cambiar el rol del último ADMIN activo.', 409);
      }
    }

    await conn.execute(
      'UPDATE usuarios SET nombre = ?, rol = ?, activo = ? WHERE id = ?',
      [nuevoNombre, nuevoRol, nuevoActivo, id]
    );

    let accion = 'ACTUALIZAR_USUARIO';
    if (cambios.activo !== undefined && nuevoActivo !== actual.activo && cambios.rol === undefined && cambios.nombre === undefined) {
      accion = nuevoActivo === 1 ? 'ACTIVAR_USUARIO' : 'DESACTIVAR_USUARIO';
    } else if (cambios.rol !== undefined && nuevoRol !== actual.rol) {
      accion = 'CAMBIAR_ROL';
    } else if (cambios.activo !== undefined && nuevoActivo !== actual.activo) {
      accion = nuevoActivo === 1 ? 'ACTIVAR_USUARIO' : 'DESACTIVAR_USUARIO';
    }

    await conn.execute(
      `INSERT INTO auditoria (usuario_id, accion, entidad, registro_id, detalles)
       VALUES (?, ?, 'usuarios', ?, JSON_OBJECT(
         'usuario', ?, 'nombre', ?, 'rol_anterior', ?, 'rol_nuevo', ?, 'activo_anterior', ?, 'activo_nuevo', ?
       ))`,
      [adminId, accion, id, actual.usuario, nuevoNombre, actual.rol, nuevoRol, actual.activo, nuevoActivo]
    );

    await conn.commit();
    return {
      id: actual.id,
      nombre: nuevoNombre,
      usuario: actual.usuario,
      rol: nuevoRol,
      activo: nuevoActivo,
      creado_utc: actual.creado_utc,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function restablecerCredencialesUsuario(id, contrasenaHash, adminId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[actual]] = await conn.execute(
      'SELECT id, nombre, usuario, rol, activo FROM usuarios WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!actual) {
      throw new UserError('La cuenta de usuario no existe.', 404);
    }
    await conn.execute(
      'UPDATE usuarios SET contrasena_hash = ? WHERE id = ?',
      [contrasenaHash, id]
    );
    await conn.execute(
      `INSERT INTO auditoria (usuario_id, accion, entidad, registro_id, detalles)
       VALUES (?, 'RESTABLECER_CREDENCIALES', 'usuarios', ?, JSON_OBJECT(
         'usuario', ?, 'rol', ?
       ))`,
      [adminId, id, actual.usuario, actual.rol]
    );
    await conn.commit();
    return {
      id: actual.id,
      nombre: actual.nombre,
      usuario: actual.usuario,
      rol: actual.rol,
      activo: actual.activo,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function consultarVehiculos(placa = '') {
  const [rows] = await pool.execute(
    `SELECT v.id,v.placa,v.tipo,v.color,v.autorizado,v.autorizacion_hasta,
      c.id AS cliente_id,c.nombre AS cliente,c.activo AS cliente_activo,
      CASE WHEN v.autorizado=1 AND c.activo=1 AND v.autorizacion_hasta>=UTC_DATE() THEN 1 ELSE 0 END AS vigente,
      (SELECT COUNT(*) FROM movimientos m WHERE m.vehiculo_id=v.id AND m.estado='ACTIVO') AS dentro
    FROM vehiculos v JOIN clientes c ON c.id=v.cliente_id
    WHERE (?='' OR v.placa LIKE CONCAT('%',?,'%')) ORDER BY v.placa LIMIT 100`,
    [placa, placa]
  );
  return rows;
}

export async function listarClientes({q = '', activo = ''} = {}) {
  const where = [];
  const params = [];
  const texto = String(q || '').trim();
  if (texto) {
    where.push('(c.nombre LIKE ? OR c.documento LIKE ? OR c.correo LIKE ?)');
    params.push(`%${texto}%`, `%${texto}%`, `%${texto}%`);
  }
  if (activo !== '' && activo !== null && activo !== undefined) {
    where.push('c.activo = ?');
    params.push(Number(activo) ? 1 : 0);
  }
  const [rows] = await pool.execute(
    `SELECT c.id, c.nombre, c.documento, c.telefono, c.correo, c.activo,
            (SELECT COUNT(*) FROM vehiculos v WHERE v.cliente_id = c.id) AS total_vehiculos
     FROM clientes c
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY c.activo DESC, c.nombre ASC, c.documento ASC`,
    params
  );
  return rows;
}

export async function detalleCliente(id) {
  const [[cliente]] = await pool.execute(
    `SELECT c.id, c.nombre, c.documento, c.telefono, c.correo, c.activo,
            (SELECT COUNT(*) FROM vehiculos v WHERE v.cliente_id = c.id) AS total_vehiculos
     FROM clientes c WHERE c.id = ? LIMIT 1`,
    [id]
  );
  if (!cliente) return null;
  const [vehiculos] = await pool.execute(
    `SELECT id, placa, tipo, color, autorizado, autorizacion_hasta,
            CASE WHEN autorizado=1 AND ? = 1 AND autorizacion_hasta>=UTC_DATE() THEN 1 ELSE 0 END AS vigente
     FROM vehiculos WHERE cliente_id = ? ORDER BY placa`,
    [cliente.activo, id]
  );
  return {...cliente, vehiculos};
}

export async function crearCliente({nombre, documento, telefono, correo, activo, usuarioId}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[existente]] = await conn.execute(
      'SELECT id FROM clientes WHERE documento = ? LIMIT 1 FOR UPDATE',
      [documento]
    );
    if (existente) {
      throw new UserError('Documento duplicado: ya pertenece a otro cliente.', 409);
    }
    const [result] = await conn.execute(
      `INSERT INTO clientes (nombre, documento, telefono, correo, activo)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre, documento, telefono, correo, activo]
    );
    await conn.execute(
      `INSERT INTO auditoria (usuario_id, accion, entidad, registro_id, detalles)
       VALUES (?, 'REGISTRAR_CLIENTE', 'clientes', ?, JSON_OBJECT(
         'nombre', ?, 'documento', ?, 'activo', ?
       ))`,
      [usuarioId, result.insertId, nombre, documento, activo]
    );
    await conn.commit();
    return {
      id: result.insertId,
      nombre,
      documento,
      telefono,
      correo,
      activo,
      total_vehiculos: 0,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function actualizarCliente(id, cambios, usuarioId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[actual]] = await conn.execute(
      'SELECT id, nombre, documento, telefono, correo, activo FROM clientes WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!actual) {
      throw new UserError('El cliente seleccionado no existe.', 404);
    }
    const nuevoNombre = cambios.nombre ?? actual.nombre;
    const nuevoDocumento = cambios.documento ?? actual.documento;
    const nuevoTelefono = cambios.telefono !== undefined ? cambios.telefono : actual.telefono;
    const nuevoCorreo = cambios.correo !== undefined ? cambios.correo : actual.correo;
    const nuevoActivo = cambios.activo ?? actual.activo;

    if (nuevoDocumento !== actual.documento) {
      const [[duplicado]] = await conn.execute(
        'SELECT id FROM clientes WHERE documento = ? AND id <> ? LIMIT 1 FOR UPDATE',
        [nuevoDocumento, id]
      );
      if (duplicado) {
        throw new UserError('Documento duplicado: ya pertenece a otro cliente.', 409);
      }
    }

    await conn.execute(
      `UPDATE clientes
       SET nombre = ?, documento = ?, telefono = ?, correo = ?, activo = ?
       WHERE id = ?`,
      [nuevoNombre, nuevoDocumento, nuevoTelefono, nuevoCorreo, nuevoActivo, id]
    );

    let accion = 'ACTUALIZAR_CLIENTE';
    if (cambios.activo !== undefined && nuevoActivo !== actual.activo) {
      accion = nuevoActivo === 1 ? 'ACTIVAR_CLIENTE' : 'DESACTIVAR_CLIENTE';
    }

    await conn.execute(
      `INSERT INTO auditoria (usuario_id, accion, entidad, registro_id, detalles)
       VALUES (?, ?, 'clientes', ?, JSON_OBJECT(
         'nombre', ?, 'documento', ?, 'activo_anterior', ?, 'activo_nuevo', ?
       ))`,
      [usuarioId, accion, id, nuevoNombre, nuevoDocumento, actual.activo, nuevoActivo]
    );

    const [[conteo]] = await conn.execute(
      'SELECT COUNT(*) AS total_vehiculos FROM vehiculos WHERE cliente_id = ?',
      [id]
    );

    await conn.commit();
    return {
      id: actual.id,
      nombre: nuevoNombre,
      documento: nuevoDocumento,
      telefono: nuevoTelefono,
      correo: nuevoCorreo,
      activo: nuevoActivo,
      total_vehiculos: conteo.total_vehiculos,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function registrarVehiculo({placa, tipo, color, clienteId, autorizado, autorizacionHasta, usuarioId}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[cliente]] = await conn.execute(
      'SELECT id,nombre,activo FROM clientes WHERE id=? FOR UPDATE',
      [clienteId]
    );
    if (!cliente) throw new UserError('El cliente seleccionado no existe.');
    if (cliente.activo !== 1) throw new UserError('El cliente seleccionado no está activo.');
    const [[existente]] = await conn.execute('SELECT id FROM vehiculos WHERE placa=? LIMIT 1', [placa]);
    if (existente) throw new UserError('La placa ya está registrada.', 409);
    const [result] = await conn.execute(
      `INSERT INTO vehiculos
      (cliente_id,placa,tipo,color,autorizado,autorizacion_hasta)
      VALUES (?,?,?,?,?,?)`,
      [clienteId, placa, tipo, color, autorizado, autorizacionHasta]
    );
    await conn.execute(
      `INSERT INTO auditoria
      (usuario_id,accion,entidad,registro_id,detalles)
      VALUES (?,'REGISTRAR_VEHICULO','vehiculos',?,JSON_OBJECT(
        'placa',?,'cliente_id',?,'tipo',?,'autorizado',?,'autorizacion_hasta',?
      ))`,
      [usuarioId, result.insertId, placa, clienteId, tipo, autorizado, autorizacionHasta]
    );
    await conn.commit();
    return {
      id: result.insertId,
      placa,
      tipo,
      color,
      autorizado,
      autorizacion_hasta: autorizacionHasta,
      cliente: cliente.nombre,
      cliente_activo: cliente.activo,
      vigente: autorizado === 1 && autorizacionHasta >= new Date().toISOString().slice(0, 10) ? 1 : 0,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function consultarCeldas(opciones = '') {
  const [rows] = await pool.query(
    `SELECT vc.*, v.tipo AS tipo_vehiculo_actual
     FROM v_celdas_ocupacion vc
     LEFT JOIN movimientos m ON m.id = vc.movimiento_activo_id
     LEFT JOIN vehiculos v ON v.id = m.vehiculo_id
     ORDER BY vc.codigo`
  );
  if (typeof opciones === 'string') {
    const tipo = opciones.trim().toUpperCase();
    return rows.filter(
      c => !tipo || c.tipo === 'MIXTA' || (tipo === 'MOTOCICLETA' ? c.tipo === 'MOTOCICLETA' : c.tipo === 'AUTOMOVIL')
    );
  }
  const {
    tipo = '',
    tipoExacto = '',
    estadoOcupacion = '',
    habilitada = '',
    q = '',
    disponibles = '',
  } = opciones || {};

  return rows.filter(c => {
    if (disponibles === '1' && c.estado_ocupacion !== 'DISPONIBLE') return false;
    if (tipoExacto && c.tipo !== String(tipoExacto).toUpperCase()) return false;
    if (tipo && !tipoExacto) {
      const t = String(tipo).toUpperCase();
      const compatible = c.tipo === 'MIXTA' || (t === 'MOTOCICLETA' ? c.tipo === 'MOTOCICLETA' : c.tipo === 'AUTOMOVIL');
      if (!compatible) return false;
    }
    if (estadoOcupacion && c.estado_ocupacion !== String(estadoOcupacion).toUpperCase()) return false;
    if (habilitada !== '' && habilitada !== null && habilitada !== undefined) {
      if (Number(c.habilitada) !== (Number(habilitada) ? 1 : 0)) return false;
    }
    if (q) {
      const term = String(q).trim().toUpperCase();
      const matchCodigo = String(c.codigo || '').toUpperCase().includes(term);
      const matchPlaca = String(c.placa_actual || '').toUpperCase().includes(term);
      if (!matchCodigo && !matchPlaca) return false;
    }
    return true;
  });
}

export async function crearCelda({codigo, tipo, habilitada, usuarioId}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[existente]] = await conn.execute(
      'SELECT id FROM celdas WHERE codigo = ? LIMIT 1 FOR UPDATE',
      [codigo]
    );
    if (existente) {
      throw new UserError('El código de celda ya existe, incluso si está deshabilitada.', 409);
    }
    const [result] = await conn.execute(
      'INSERT INTO celdas (codigo, tipo, habilitada) VALUES (?, ?, ?)',
      [codigo, tipo, habilitada]
    );
    await conn.execute(
      `INSERT INTO auditoria (usuario_id, accion, entidad, registro_id, detalles)
       VALUES (?, 'CREAR_CELDA', 'celdas', ?, JSON_OBJECT(
         'codigo', ?, 'tipo', ?, 'habilitada', ?
       ))`,
      [usuarioId, result.insertId, codigo, tipo, habilitada]
    );
    await conn.commit();
    return {
      id: result.insertId,
      codigo,
      tipo,
      habilitada,
      estado_ocupacion: habilitada === 1 ? 'DISPONIBLE' : 'INHABILITADA',
      movimiento_activo_id: null,
      placa_actual: null,
      tipo_vehiculo_actual: null,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function actualizarCelda(id, cambios, usuarioId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[actual]] = await conn.execute(
      `SELECT c.id, c.codigo, c.tipo, c.habilitada,
              m.id AS movimiento_activo_id,
              v.placa AS placa_actual,
              v.tipo AS tipo_vehiculo_actual,
              CASE WHEN m.id IS NOT NULL THEN 'OCUPADA'
                   WHEN c.habilitada = 0 THEN 'INHABILITADA'
                   ELSE 'DISPONIBLE' END AS estado_ocupacion
       FROM celdas c
       LEFT JOIN movimientos m ON m.celda_id = c.id AND m.estado = 'ACTIVO'
       LEFT JOIN vehiculos v ON v.id = m.vehiculo_id
       WHERE c.id = ? FOR UPDATE`,
      [id]
    );
    if (!actual) {
      throw new UserError('La celda indicada no existe.', 404);
    }

    validarCambioCeldaOcupada(actual, cambios);

    const nuevoCodigo = cambios.codigo ?? actual.codigo;
    const nuevoTipo = cambios.tipo ?? actual.tipo;
    const nuevaHabilitada = cambios.habilitada ?? actual.habilitada;

    if (nuevoCodigo !== actual.codigo) {
      const [[duplicada]] = await conn.execute(
        'SELECT id FROM celdas WHERE codigo = ? AND id <> ? LIMIT 1 FOR UPDATE',
        [nuevoCodigo, id]
      );
      if (duplicada) {
        throw new UserError('El código de celda ya existe, incluso si está deshabilitada.', 409);
      }
    }

    await conn.execute(
      'UPDATE celdas SET codigo = ?, tipo = ?, habilitada = ? WHERE id = ?',
      [nuevoCodigo, nuevoTipo, nuevaHabilitada, id]
    );

    let accion = 'ACTUALIZAR_CELDA';
    if (cambios.habilitada !== undefined && nuevaHabilitada !== actual.habilitada) {
      accion = nuevaHabilitada === 1 ? 'HABILITAR_CELDA' : 'DESHABILITAR_CELDA';
    }

    await conn.execute(
      `INSERT INTO auditoria (usuario_id, accion, entidad, registro_id, detalles)
       VALUES (?, ?, 'celdas', ?, JSON_OBJECT(
         'codigo', ?, 'tipo_anterior', ?, 'tipo_nuevo', ?, 'habilitada_anterior', ?, 'habilitada_nueva', ?
       ))`,
      [usuarioId, accion, id, nuevoCodigo, actual.tipo, nuevoTipo, actual.habilitada, nuevaHabilitada]
    );

    await conn.commit();
    return {
      id: actual.id,
      codigo: nuevoCodigo,
      tipo: nuevoTipo,
      habilitada: nuevaHabilitada,
      estado_ocupacion: actual.movimiento_activo_id
        ? 'OCUPADA'
        : nuevaHabilitada === 0
          ? 'INHABILITADA'
          : 'DISPONIBLE',
      movimiento_activo_id: actual.movimiento_activo_id,
      placa_actual: actual.placa_actual,
      tipo_vehiculo_actual: actual.tipo_vehiculo_actual,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function consultarPanel() {
  const [[row]] = await pool.query(`SELECT
    (SELECT COUNT(*) FROM celdas WHERE habilitada=1) AS total,
    (SELECT COUNT(*) FROM celdas WHERE habilitada=0) AS inhabilitadas,
    (SELECT COUNT(*) FROM celdas) AS total_celdas,
    (SELECT COUNT(*) FROM movimientos WHERE estado='ACTIVO') AS ocupadas,
    (SELECT COUNT(*) FROM v_celdas_ocupacion WHERE estado_ocupacion='DISPONIBLE') AS disponibles,
    (SELECT COUNT(*) FROM movimientos WHERE DATE(fecha_entrada_utc-INTERVAL 5 HOUR)=DATE(UTC_TIMESTAMP()-INTERVAL 5 HOUR)) AS entradas_hoy,
    (SELECT COUNT(*) FROM usuarios WHERE activo=1) AS cuentas_activas,
    (SELECT COUNT(*) FROM usuarios WHERE activo=1 AND rol='ADMIN') AS admins_activos,
    (SELECT COUNT(*) FROM usuarios WHERE activo=1 AND rol='OPERADOR') AS operadores_activos,
    (SELECT COUNT(*) FROM usuarios WHERE activo=0) AS cuentas_inactivas,
    (SELECT COUNT(*) FROM clientes) AS clientes_total,
    (SELECT COUNT(*) FROM clientes WHERE activo=1) AS clientes_activos,
    (SELECT COUNT(*) FROM clientes WHERE activo=0) AS clientes_inactivos,
    (SELECT COUNT(*) FROM auditoria WHERE DATE(fecha_utc-INTERVAL 5 HOUR)=DATE(UTC_TIMESTAMP()-INTERVAL 5 HOUR)) AS eventos_hoy`);
  return row;
}

export async function listarMovimientos({estado = '', placa = '', desde = null, hasta = null, limit = 100}) {
  const where = [];
  const params = [];
  if (estado) {
    where.push('m.estado=?');
    params.push(estado);
  }
  if (placa) {
    where.push('v.placa LIKE ?');
    params.push('%' + placa + '%');
  }
  if (desde) {
    where.push('m.fecha_entrada_utc>=?');
    params.push(`${desde} 05:00:00`);
  }
  if (hasta) {
    where.push('m.fecha_entrada_utc<DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(`${hasta} 05:00:00`);
  }
  const [rows] = await pool.query(
    `SELECT m.id,m.vehiculo_id,m.celda_id,m.estado,m.fecha_entrada_utc,m.fecha_salida_utc,
  v.placa,v.tipo,c.codigo AS celda,u.nombre AS operador_entrada,us.nombre AS operador_salida,
  TIMESTAMPDIFF(MINUTE,m.fecha_entrada_utc,COALESCE(m.fecha_salida_utc,UTC_TIMESTAMP())) AS minutos
  FROM movimientos m JOIN vehiculos v ON v.id=m.vehiculo_id JOIN celdas c ON c.id=m.celda_id
  JOIN usuarios u ON u.id=m.usuario_entrada_id LEFT JOIN usuarios us ON us.id=m.usuario_salida_id
  ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.fecha_entrada_utc DESC LIMIT ?`,
    [...params, limit]
  );
  return rows;
}

export async function detalleMovimiento(id) {
  const [rows] = await pool.execute(
    `SELECT m.id,m.estado,m.fecha_entrada_utc,m.fecha_salida_utc,v.placa,v.tipo,c.codigo AS celda,
  u.nombre AS operador_entrada,us.nombre AS operador_salida
  FROM movimientos m JOIN vehiculos v ON v.id=m.vehiculo_id JOIN celdas c ON c.id=m.celda_id
  JOIN usuarios u ON u.id=m.usuario_entrada_id LEFT JOIN usuarios us ON us.id=m.usuario_salida_id
  WHERE m.id=?`,
    [id]
  );
  if (!rows.length) return null;
  const [novedades] = await pool.execute(
    `SELECT n.id,n.tipo,n.descripcion,n.fecha_utc,u.nombre AS operador FROM novedades n
  JOIN usuarios u ON u.id=n.usuario_id WHERE n.movimiento_id=? ORDER BY n.fecha_utc DESC`,
    [id]
  );
  return {...rows[0], novedades};
}

export async function registrarEntrada(placa, celda, usuarioId) {
  const conn = await pool.getConnection();
  try {
    await conn.query('CALL sp_registrar_entrada(?,?,?,@autos_nuevo_mov)', [placa, celda, usuarioId]);
    const [[record]] = await conn.query('SELECT @autos_nuevo_mov AS id');
    return record.id;
  } finally {
    conn.release();
  }
}

export async function registrarSalida(id, usuarioId) {
  await pool.query('CALL sp_registrar_salida(?,?)', [id, usuarioId]);
}

export async function registrarNovedad({id, tipo, descripcion, usuarioId}) {
  await pool.query('CALL sp_registrar_novedad(?,?,?,?)', [id, usuarioId, tipo, descripcion]);
}

export async function listarNovedades() {
  const [rows] = await pool.query(
    `SELECT n.id,n.tipo,n.descripcion,n.fecha_utc,m.id AS movimiento_id,v.placa,u.nombre AS operador
  FROM novedades n JOIN movimientos m ON m.id=n.movimiento_id JOIN vehiculos v ON v.id=m.vehiculo_id
  JOIN usuarios u ON u.id=n.usuario_id ORDER BY n.fecha_utc DESC LIMIT 100`
  );
  return rows;
}

export async function listarAuditoria({q = '', entidad = '', accion = '', desde = null, hasta = null, dias = ''} = {}) {
  const where = [];
  const params = [];
  const texto = String(q || '').trim();
  if (texto) {
    where.push('(u.nombre LIKE ? OR u.usuario LIKE ? OR a.accion LIKE ? OR a.entidad LIKE ? OR CAST(a.registro_id AS CHAR) LIKE ?)');
    params.push(`%${texto}%`, `%${texto}%`, `%${texto}%`, `%${texto}%`, `%${texto}%`);
  }
  if (entidad) {
    where.push('a.entidad = ?');
    params.push(String(entidad).trim().toLowerCase());
  }
  if (accion) {
    where.push('a.accion = ?');
    params.push(String(accion).trim().toUpperCase());
  }
  if (dias && /^\d+$/.test(String(dias))) {
    where.push('a.fecha_utc >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)');
    params.push(Number(dias));
  }
  if (desde) {
    where.push('a.fecha_utc >= ?');
    params.push(`${desde} 05:00:00`);
  }
  if (hasta) {
    where.push('a.fecha_utc < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(`${hasta} 05:00:00`);
  }
  const [rows] = await pool.query(
    `SELECT a.id, a.accion, a.entidad, a.registro_id, a.detalles, a.fecha_utc,
            u.nombre AS operador, u.usuario AS usuario_login, u.rol AS rol_operador
     FROM auditoria a
     JOIN usuarios u ON u.id = a.usuario_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY a.fecha_utc DESC, a.id DESC
     LIMIT 150`,
    params
  );
  return rows;
}
