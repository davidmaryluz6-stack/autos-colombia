export const TIPOS_NOVEDAD = new Set(['OBSERVACION', 'INCIDENTE', 'ACCESO', 'OTRO']);
export const ESTADOS = new Set(['ACTIVO', 'FINALIZADO']);
export const TIPOS_VEHICULO = new Set(['AUTOMOVIL', 'MOTOCICLETA', 'CAMIONETA', 'OTRO']);

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
