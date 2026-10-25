import {pool} from './db.js';
import {UserError} from './validation.js';
export async function obtenerUsuario(usuario) {
 const [[row]]=await pool.execute('SELECT id,nombre,usuario,contrasena_hash,rol,activo FROM usuarios WHERE usuario=? LIMIT 1',[usuario]);
 return row||null;
}
export async function usuarioActivo(id) {
 const [[row]]=await pool.execute('SELECT id,nombre,usuario,rol FROM usuarios WHERE id=? AND activo=1 LIMIT 1',[id]);
 return row||null;
}
export async function consultarVehiculos(placa='') {
 const [rows]=await pool.execute(`SELECT v.id,v.placa,v.tipo,v.color,v.autorizado,v.autorizacion_hasta,
     c.nombre AS cliente,c.activo AS cliente_activo,
     CASE WHEN v.autorizado=1 AND c.activo=1 AND v.autorizacion_hasta>=UTC_DATE() THEN 1 ELSE 0 END AS vigente,
     (SELECT COUNT(*) FROM movimientos m WHERE m.vehiculo_id=v.id AND m.estado='ACTIVO') AS dentro
   FROM vehiculos v JOIN clientes c ON c.id=v.cliente_id
   WHERE (?='' OR v.placa LIKE CONCAT('%',?,'%')) ORDER BY v.placa LIMIT 100`,[placa,placa]);
 return rows;
}
export async function listarClientes() {
 const [rows]=await pool.query(`SELECT id,nombre,documento,activo
   FROM clientes ORDER BY activo DESC,nombre,documento`);
 return rows;
}
export async function registrarVehiculo({placa,tipo,color,clienteId,autorizado,autorizacionHasta,usuarioId}) {
 const conn=await pool.getConnection();
 try {
   await conn.beginTransaction();
   const [[cliente]]=await conn.execute(
     'SELECT id,nombre,activo FROM clientes WHERE id=? FOR UPDATE',[clienteId]);
   if(!cliente)throw new UserError('El cliente seleccionado no existe.');
   if(cliente.activo!==1)throw new UserError('El cliente seleccionado no está activo.');
   const [[existente]]=await conn.execute('SELECT id FROM vehiculos WHERE placa=? LIMIT 1',[placa]);
   if(existente)throw new UserError('La placa ya está registrada.',409);
   const [result]=await conn.execute(`INSERT INTO vehiculos
     (cliente_id,placa,tipo,color,autorizado,autorizacion_hasta)
     VALUES (?,?,?,?,?,?)`,[clienteId,placa,tipo,color,autorizado,autorizacionHasta]);
   await conn.execute(`INSERT INTO auditoria
     (usuario_id,accion,entidad,registro_id,detalles)
     VALUES (?,'REGISTRAR_VEHICULO','vehiculos',?,JSON_OBJECT(
       'placa',?,'cliente_id',?,'tipo',?,'autorizado',?,'autorizacion_hasta',?
     ))`,[usuarioId,result.insertId,placa,clienteId,tipo,autorizado,autorizacionHasta]);
   await conn.commit();
   return {
     id:result.insertId,placa,tipo,color,autorizado,autorizacion_hasta:autorizacionHasta,
     cliente:cliente.nombre,cliente_activo:cliente.activo,
     vigente:autorizado===1 && autorizacionHasta>=new Date().toISOString().slice(0,10) ? 1 : 0,
   };
 } catch(error) {
   await conn.rollback();
   throw error;
 } finally {conn.release();}
}
export async function consultarCeldas(tipo='') {
 const [rows]=await pool.query('SELECT * FROM v_celdas_ocupacion ORDER BY codigo');
 return rows.filter(c => !tipo || c.tipo==='MIXTA' || (tipo==='MOTOCICLETA'?c.tipo==='MOTOCICLETA':c.tipo==='AUTOMOVIL'));
}
export async function consultarPanel() {
 const [[row]]=await pool.query(`SELECT
    (SELECT COUNT(*) FROM celdas WHERE habilitada=1) AS total,
    (SELECT COUNT(*) FROM movimientos WHERE estado='ACTIVO') AS ocupadas,
    (SELECT COUNT(*) FROM v_celdas_ocupacion WHERE estado_ocupacion='DISPONIBLE') AS disponibles,
    (SELECT COUNT(*) FROM movimientos WHERE DATE(fecha_entrada_utc-INTERVAL 5 HOUR)=DATE(UTC_TIMESTAMP()-INTERVAL 5 HOUR)) AS entradas_hoy`);
 return row;
}
export async function listarMovimientos({estado='',placa='',desde=null,hasta=null,limit=100}) {
 let where=[], params=[];
 if (estado) {where.push('m.estado=?');params.push(estado);}
 if (placa) {where.push('v.placa LIKE ?');params.push('%'+placa+'%');}
 if (desde) {where.push('m.fecha_entrada_utc>=?');params.push(`${desde} 05:00:00`);}
 if (hasta) {where.push('m.fecha_entrada_utc<DATE_ADD(?, INTERVAL 1 DAY)');params.push(`${hasta} 05:00:00`);}
 const [rows]=await pool.query(`SELECT m.id,m.vehiculo_id,m.celda_id,m.estado,m.fecha_entrada_utc,m.fecha_salida_utc,
 v.placa,v.tipo,c.codigo AS celda,u.nombre AS operador_entrada,us.nombre AS operador_salida,
 TIMESTAMPDIFF(MINUTE,m.fecha_entrada_utc,COALESCE(m.fecha_salida_utc,UTC_TIMESTAMP())) AS minutos
 FROM movimientos m JOIN vehiculos v ON v.id=m.vehiculo_id JOIN celdas c ON c.id=m.celda_id
 JOIN usuarios u ON u.id=m.usuario_entrada_id LEFT JOIN usuarios us ON us.id=m.usuario_salida_id
 ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY m.fecha_entrada_utc DESC LIMIT ?`,[...params,limit]);
 return rows;
}
export async function detalleMovimiento(id) {
 const [rows]=await pool.execute(`SELECT m.id,m.estado,m.fecha_entrada_utc,m.fecha_salida_utc,v.placa,v.tipo,c.codigo AS celda,
 u.nombre AS operador_entrada,us.nombre AS operador_salida
 FROM movimientos m JOIN vehiculos v ON v.id=m.vehiculo_id JOIN celdas c ON c.id=m.celda_id
 JOIN usuarios u ON u.id=m.usuario_entrada_id LEFT JOIN usuarios us ON us.id=m.usuario_salida_id
 WHERE m.id=?`,[id]);
 if (!rows.length) return null;
 const [novedades]=await pool.execute(`SELECT n.id,n.tipo,n.descripcion,n.fecha_utc,u.nombre AS operador FROM novedades n
 JOIN usuarios u ON u.id=n.usuario_id WHERE n.movimiento_id=? ORDER BY n.fecha_utc DESC`,[id]);
 return {...rows[0],novedades};
}
export async function registrarEntrada(placa,celda,usuarioId) {
 const conn=await pool.getConnection();
 try {
   await conn.query('CALL sp_registrar_entrada(?,?,?,@autos_nuevo_mov)',[placa,celda,usuarioId]);
   const [[record]]=await conn.query('SELECT @autos_nuevo_mov AS id');
   return record.id;
 } finally {conn.release();}
}
export async function registrarSalida(id,usuarioId) {
 await pool.query('CALL sp_registrar_salida(?,?)',[id,usuarioId]);
}
export async function registrarNovedad({id,tipo,descripcion,usuarioId}) {
 await pool.query('CALL sp_registrar_novedad(?,?,?,?)',[id,usuarioId,tipo,descripcion]);
}
export async function listarNovedades() {
 const [rows]=await pool.query(`SELECT n.id,n.tipo,n.descripcion,n.fecha_utc,m.id AS movimiento_id,v.placa,u.nombre AS operador
 FROM novedades n JOIN movimientos m ON m.id=n.movimiento_id JOIN vehiculos v ON v.id=m.vehiculo_id
 JOIN usuarios u ON u.id=n.usuario_id ORDER BY n.fecha_utc DESC LIMIT 100`);
 return rows;
}
export async function listarAuditoria() {
 const [rows]=await pool.query(`SELECT a.id,a.accion,a.entidad,a.registro_id,a.detalles,a.fecha_utc,u.nombre AS operador
 FROM auditoria a JOIN usuarios u ON u.id=a.usuario_id ORDER BY a.fecha_utc DESC LIMIT 100`);
 return rows;
}
