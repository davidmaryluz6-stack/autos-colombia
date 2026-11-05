export const TIPOS_NOVEDAD = new Set(['OBSERVACION', 'INCIDENTE', 'ACCESO', 'OTRO']);
export const ESTADOS = new Set(['ACTIVO', 'FINALIZADO']);
export const TIPOS_VEHICULO = new Set(['AUTOMOVIL', 'MOTOCICLETA', 'CAMIONETA', 'OTRO']);
export const ROLES_USUARIO = new Set(['ADMIN', 'OPERADOR']);
export const TIPOS_CELDA = new Set(['AUTOMOVIL', 'MOTOCICLETA', 'MIXTA']);
export const ESTADOS_OCUPACION = new Set(['DISPONIBLE', 'OCUPADA', 'INHABILITADA']);

export class UserError extends Error {
  constructor(message, status = 400) { super(message); this.name = 'UserError'; this.status = status; }
}
export const parseId = (value) => {
  const str = String(value ?? '');
  if (!/^[1-9]\d{0,14}$/.test(str)) throw new UserError('Identificador no válido');
  return str;
};
export const normalizarPlaca = (v) => {
  const s = String(v ?? '').toUpperCase().replace(/\s/g, '').trim();
  if (!/^[A-Z0-9-]{5,10}$/.test(s)) throw new UserError('La placa debe tener entre 5 y 10 caracteres válidos.');
  return s;
};
export const normalizarCelda = (v) => {
  const s = String(v ?? '').toUpperCase().trim();
  if (!/^[A-Z0-9-]{1,16}$/.test(s)) throw new UserError('Código de celda no válido.');
  return s;
};
export const normalizarUsuario = (v) => {
  const s = String(v ?? '').toLowerCase().trim();
  if (!/^[a-z0-9._-]{3,60}$/.test(s)) {
    throw new UserError('El usuario debe tener entre 3 y 60 caracteres (letras, números, punto, guion o guion bajo).');
  }
  return s;
};
export const normalizarDocumento = (v) => {
  const s = String(v ?? '').toUpperCase().replace(/\s+/g, '').trim();
  if (!/^[A-Z0-9.-]{4,25}$/.test(s)) {
    throw new UserError('El documento debe tener entre 4 y 25 caracteres alfanuméricos válidos.');
  }
  return s;
};
export const validarNombre = (v, campo = 'El nombre') => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (s.length < 3 || s.length > 120 || /[\u0000-\u001F\u007F]/.test(s)) {
    throw new UserError(`${campo} debe tener entre 3 y 120 caracteres válidos.`);
  }
  return s;
};
export const validarContrasena = (v) => {
  const s = String(v ?? '');
  if (s.length < 8 || s.length > 120 || /[\u0000-\u001F\u007F]/.test(s)) {
    throw new UserError('La contraseña debe tener entre 8 y 120 caracteres válidos.');
  }
  return s;
};
const normalizarBooleano = (valor, mensaje) => {
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  if (valor === 1 || valor === '1' || valor === 'true') return 1;
  if (valor === 0 || valor === '0' || valor === 'false') return 0;
  throw new UserError(mensaje);
};
const fechaCalendarioValida = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
export const validarVehiculo = ({placa, tipo, color, clienteId, autorizado, autorizacionHasta}) => {
  const placaNormalizada = normalizarPlaca(placa);
  const tipoNormalizado = String(tipo ?? '').trim().toUpperCase();
  const colorNormalizado = String(color ?? '').trim();
  const clienteIdNormalizado = parseId(clienteId);
  const fechaNormalizada = String(autorizacionHasta ?? '').trim();
  if (!TIPOS_VEHICULO.has(tipoNormalizado)) throw new UserError('Tipo de vehículo no válido.');
  if (colorNormalizado.length > 35 || /[\u0000-\u001F\u007F]/.test(colorNormalizado)) {
    throw new UserError('El color debe tener máximo 35 caracteres válidos.');
  }
  if (typeof autorizado !== 'boolean') throw new UserError('El estado de autorización no es válido.');
  if (!fechaCalendarioValida(fechaNormalizada)) {
    throw new UserError('La fecha de vencimiento debe ser una fecha valida en formato AAAA-MM-DD.');
  }
  return {
    placa: placaNormalizada,
    tipo: tipoNormalizado,
    color: colorNormalizado || null,
    clienteId: clienteIdNormalizado,
    autorizado: autorizado ? 1 : 0,
    autorizacionHasta: fechaNormalizada,
  };
};
export const validarNovedad = ({movimientoId, tipo, descripcion}) => {
  const id = parseId(movimientoId);
  const tipoLimpio = String(tipo ?? '').toUpperCase();
  const texto = String(descripcion ?? '').trim();
  if (!TIPOS_NOVEDAD.has(tipoLimpio)) throw new UserError('Tipo de novedad no válido.');
  if (texto.length < 5 || texto.length > 2000) throw new UserError('La descripción debe tener entre 5 y 2000 caracteres.');
  return { id, tipo: tipoLimpio, descripcion: texto };
};
export const validarFechas = ({desde, hasta}) => {
  const check = s => !s || /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
  if (!check(desde) || !check(hasta)) throw new UserError('Las fechas deben usar AAAA-MM-DD.');
  if (desde && hasta && desde > hasta) throw new UserError('La fecha inicial no puede superar la final.');
  return { desde: desde || null, hasta: hasta || null };
};
export const compatibleConCelda = (tipoVehiculo, tipoCelda) =>
  tipoCelda === 'MIXTA' || (tipoVehiculo === 'MOTOCICLETA' && tipoCelda === 'MOTOCICLETA') ||
  (tipoVehiculo !== 'MOTOCICLETA' && tipoCelda === 'AUTOMOVIL');

export const validarCuentaCrear = ({nombre, usuario, contrasena, rol = 'OPERADOR', activo = true}) => {
  const nombreLimpio = validarNombre(nombre, 'El nombre completo');
  const usuarioLimpio = normalizarUsuario(usuario);
  const contrasenaLimpia = validarContrasena(contrasena);
  const rolLimpio = String(rol ?? '').trim().toUpperCase();
  if (!ROLES_USUARIO.has(rolLimpio)) throw new UserError('Rol de usuario no válido.');
  const activoLimpio = normalizarBooleano(activo, 'El estado de la cuenta no es válido.');
  return {
    nombre: nombreLimpio,
    usuario: usuarioLimpio,
    contrasena: contrasenaLimpia,
    rol: rolLimpio,
    activo: activoLimpio,
  };
};

export const validarCuentaActualizar = (datos = {}) => {
  const salida = {};
  if (datos.nombre !== undefined) {
    salida.nombre = validarNombre(datos.nombre, 'El nombre completo');
  }
  if (datos.rol !== undefined) {
    const rolLimpio = String(datos.rol ?? '').trim().toUpperCase();
    if (!ROLES_USUARIO.has(rolLimpio)) throw new UserError('Rol de usuario no válido.');
    salida.rol = rolLimpio;
  }
  if (datos.activo !== undefined) {
    salida.activo = normalizarBooleano(datos.activo, 'El estado de la cuenta no es válido.');
  }
  if (!Object.keys(salida).length) {
    throw new UserError('Debes indicar al menos un campo para actualizar la cuenta.');
  }
  return salida;
};

export const validarCredenciales = ({contrasena, confirmacion}) => {
  const limpia = validarContrasena(contrasena);
  if (confirmacion !== undefined && String(confirmacion) !== limpia) {
    throw new UserError('La confirmación de la contraseña no coincide.');
  }
  return { contrasena: limpia };
};

export const validarTelefono = (v) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (s.length > 25 || !/^[0-9+()\-\s]{7,25}$/.test(s)) {
    throw new UserError('El teléfono debe tener entre 7 y 25 caracteres numéricos válidos.');
  }
  return s;
};

export const validarCorreo = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.length > 120 || /[\u0000-\u001F\u007F]/.test(s) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) {
    throw new UserError('El correo electrónico no tiene un formato válido.');
  }
  return s;
};

export const validarClienteCrear = ({nombre, documento, telefono = '', correo = '', activo = true}) => {
  const nombreLimpio = validarNombre(nombre, 'El nombre del cliente');
  const documentoLimpio = normalizarDocumento(documento);
  const telefonoLimpio = validarTelefono(telefono);
  const correoLimpio = validarCorreo(correo);
  const activoLimpio = normalizarBooleano(activo, 'El estado del cliente no es válido.');
  return {
    nombre: nombreLimpio,
    documento: documentoLimpio,
    telefono: telefonoLimpio,
    correo: correoLimpio,
    activo: activoLimpio,
  };
};

export const validarClienteActualizar = (datos = {}) => {
  const salida = {};
  if (datos.nombre !== undefined) salida.nombre = validarNombre(datos.nombre, 'El nombre del cliente');
  if (datos.documento !== undefined) salida.documento = normalizarDocumento(datos.documento);
  if (datos.telefono !== undefined) salida.telefono = validarTelefono(datos.telefono);
  if (datos.correo !== undefined) salida.correo = validarCorreo(datos.correo);
  if (datos.activo !== undefined) salida.activo = normalizarBooleano(datos.activo, 'El estado del cliente no es válido.');
  if (!Object.keys(salida).length) {
    throw new UserError('Debes indicar al menos un dato para actualizar el cliente.');
  }
  return salida;
};

export const validarCeldaCrear = ({codigo, tipo = 'MIXTA', habilitada = true}) => {
  const codigoLimpio = normalizarCelda(codigo);
  const tipoLimpio = String(tipo ?? '').trim().toUpperCase();
  if (!TIPOS_CELDA.has(tipoLimpio)) throw new UserError('Tipo de celda no válido.');
  const habilitadaLimpia = normalizarBooleano(habilitada, 'El estado de habilitación no es válido.');
  return {
    codigo: codigoLimpio,
    tipo: tipoLimpio,
    habilitada: habilitadaLimpia,
  };
};

export const validarCeldaActualizar = (datos = {}) => {
  const salida = {};
  if (datos.codigo !== undefined) salida.codigo = normalizarCelda(datos.codigo);
  if (datos.tipo !== undefined) {
    const tipoLimpio = String(datos.tipo ?? '').trim().toUpperCase();
    if (!TIPOS_CELDA.has(tipoLimpio)) throw new UserError('Tipo de celda no válido.');
    salida.tipo = tipoLimpio;
  }
  if (datos.habilitada !== undefined) {
    salida.habilitada = normalizarBooleano(datos.habilitada, 'El estado de habilitación no es válido.');
  }
  if (!Object.keys(salida).length) {
    throw new UserError('Debes indicar al menos un atributo para actualizar la celda.');
  }
  return salida;
};

export const validarCambioCeldaOcupada = (celdaActual, cambios) => {
  const ocupada = celdaActual?.estado_ocupacion === 'OCUPADA' || Boolean(celdaActual?.movimiento_activo_id);
  if (!ocupada) return;
  if (cambios.habilitada !== undefined && Number(cambios.habilitada) === 0) {
    throw new UserError('No se puede deshabilitar una celda con permanencia activa.', 409);
  }
  if (cambios.codigo !== undefined && cambios.codigo !== celdaActual.codigo) {
    throw new UserError('No se puede modificar el código de una celda con permanencia activa.', 409);
  }
  if (cambios.tipo !== undefined && cambios.tipo !== celdaActual.tipo) {
    const tipoVehiculo = celdaActual.tipo_vehiculo_actual || celdaActual.vehiculo_tipo;
    if (!tipoVehiculo || !compatibleConCelda(tipoVehiculo, cambios.tipo)) {
      throw new UserError('No se puede cambiar una celda ocupada a un tipo incompatible con el vehículo actual.', 409);
    }
  }
};
