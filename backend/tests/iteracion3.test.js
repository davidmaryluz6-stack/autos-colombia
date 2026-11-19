import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { crearApp } from '../src/app.js';
import { invocarApp } from './helpers/invocar.js';
import {
  UserError, validarPago, validarAnulacionPago, normalizarPeriodo, normalizarValorPago,
  normalizarReferencia, numeroComprobante, periodosHasta, configPagos,
} from '../src/validation.js';

process.env.SESSION_SECRET = 'clave_aleatoria_local_para_pruebas_de_sesion_segura_2026';

// Repositorio en memoria que replica las reglas de repository.js (sin MySQL).
// Las consultas SQL reales y los UNIQUE de la migración 05 requieren MySQL 8 y NO se prueban aquí.
async function entorno() {
  const hash = await bcrypt.hash('Demo2026!', 8);
  const st = {
    usuarios: [
      { id: 1, nombre: 'Administrador Demo', usuario: 'administrador', contrasena_hash: hash, rol: 'ADMIN', activo: 1 },
      { id: 2, nombre: 'Operador Demo', usuario: 'operador', contrasena_hash: hash, rol: 'OPERADOR', activo: 1 },
    ],
    clientes: [
      { id: 1, nombre: 'Cliente Uno', documento: 'DOC-001', telefono: '300', activo: 1 },
      { id: 2, nombre: 'Cliente Inactivo', documento: 'DOC-002', telefono: null, activo: 0 },
    ],
    vehiculos: [
      { id: 1, cliente_id: 1, placa: 'ABC123', tipo: 'AUTOMOVIL', autorizado: 1 },
      { id: 2, cliente_id: 1, placa: 'MOTO99', tipo: 'MOTOCICLETA', autorizado: 1 },
      { id: 3, cliente_id: 2, placa: 'INA111', tipo: 'AUTOMOVIL', autorizado: 1 },
    ],
    pagos: [],
    auditoria: [],
  };
  const repo = {
    async obtenerUsuario(u) { return st.usuarios.find(x => x.usuario === u) || null; },
    async usuarioActivo(id) {
      const u = st.usuarios.find(x => x.id === Number(id) && x.activo === 1);
      return u ? { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol } : null;
    },
    async listarPagos({ placa = '', clienteId = '', periodo = '', estado = '' } = {}) {
      return st.pagos.filter(p => (!placa || p.placa.includes(placa)) && (!clienteId || String(p.cliente_id) === clienteId)
        && (!periodo || p.periodo === periodo) && (!estado || p.estado === estado));
    },
    async detallePago(id) { return st.pagos.find(p => p.id === Number(id)) || null; },
    async registrarPago({ vehiculoId, periodo, valor, metodo, referencia, observacion, usuarioId }) {
      const v = st.vehiculos.find(x => x.id === Number(vehiculoId));
      if (!v) throw new UserError('El vehículo seleccionado no existe.', 404);
      const c = st.clientes.find(x => x.id === v.cliente_id);
      if (c.activo !== 1) throw new UserError('El cliente del vehículo no está activo.', 409);
      if (st.pagos.some(p => p.vehiculo_id === v.id && p.periodo === periodo && p.estado === 'REGISTRADO')) {
        throw new UserError('Ya existe un pago registrado para ese vehículo y periodo.', 409);
      }
      if (referencia && st.pagos.some(p => p.metodo === metodo && p.referencia === referencia && p.estado === 'REGISTRADO')) {
        throw new UserError('La referencia ya fue utilizada en otro pago registrado.', 409);
      }
      const pago = {
        id: st.pagos.length + 1, cliente_id: c.id, vehiculo_id: v.id, placa: v.placa, cliente: c.nombre,
        documento: c.documento, periodo, valor, metodo, referencia, observacion, estado: 'REGISTRADO',
        fecha_pago_utc: '2026-11-18 10:00:00', registrado_por: 'x', usuario_id: usuarioId,
      };
      st.pagos.push(pago);
      st.auditoria.push({ accion: 'REGISTRAR_PAGO', registro_id: pago.id });
      return { id: pago.id, comprobante: numeroComprobante(pago.id), placa: v.placa, periodo, valor, metodo, estado: 'REGISTRADO' };
    },
    async anularPago(id, motivo, usuarioId) {
      const p = st.pagos.find(x => x.id === Number(id));
      if (!p) throw new UserError('Pago no encontrado.', 404);
      if (p.estado === 'ANULADO') throw new UserError('El pago ya se encuentra anulado.', 409);
      Object.assign(p, { estado: 'ANULADO', motivo_anulacion: motivo, anulado_por: String(usuarioId) });
      st.auditoria.push({ accion: 'ANULAR_PAGO', registro_id: p.id });
      return p;
    },
    async consultarCartera({ periodo, meses, valorReferencia }) {
      const pers = periodosHasta(periodo, meses);
      const out = [];
      for (const v of st.vehiculos.filter(x => x.autorizado === 1)) {
        const c = st.clientes.find(x => x.id === v.cliente_id);
        if (c.activo !== 1) continue;
        for (const per of pers) {
          if (!st.pagos.some(p => p.vehiculo_id === v.id && p.periodo === per && p.estado === 'REGISTRADO')) {
            out.push({ vehiculo_id: v.id, placa: v.placa, cliente: c.nombre, periodo: per, valor_estimado: valorReferencia });
          }
        }
      }
      return out;
    },
  };
  const app = crearApp(repo, { query: async () => [[{ ok: 1 }]] });
  const req = (path, o) => invocarApp(app, path, o);
  const login = async u => (await req('/api/auth/login', { method: 'POST', body: { usuario: u, contrasena: 'Demo2026!' } })).cookie;
  return { st, req, admin: await login('administrador'), oper: await login('operador') };
}

const periodoOk = () => `${new Date().toISOString().slice(0, 7)}-01`;
const body = (o = {}) => ({ vehiculoId: 1, periodo: periodoOk().slice(0, 7), valor: 150000, metodo: 'EFECTIVO', ...o });

// ---- Validaciones unitarias ----
test('CP3-01 valor válido se normaliza a dos decimales', () => assert.equal(normalizarValorPago('150000'), '150000.00'));
test('CP3-02 rechaza valor cero, negativo, texto y exceso', () => {
  for (const v of [0, '0', -5, 'abc', '', null, '1e5', '10.999', 99999999999]) assert.throws(() => normalizarValorPago(v), UserError);
});
test('CP3-03 periodo normaliza AAAA-MM y rechaza formatos inválidos', () => {
  assert.equal(normalizarPeriodo('2026-11'), '2026-11-01');
  for (const v of ['2026-13', '26-11', '', 'noviembre', '2026-00', '1999-01']) assert.throws(() => normalizarPeriodo(v), UserError);
});
test('CP3-04 rechaza periodos con más de 12 meses de anticipación', () => {
  assert.throws(() => normalizarPeriodo('2030-01', new Date('2026-11-18T00:00:00Z')), UserError);
  assert.equal(normalizarPeriodo('2027-11', new Date('2026-11-18T00:00:00Z')), '2027-11-01');
});
test('CP3-05 referencia obligatoria si el método no es efectivo', () => {
  assert.throws(() => validarPago(body({ metodo: 'TRANSFERENCIA' })), /referencia es obligatoria/);
  assert.equal(validarPago(body({ metodo: 'transferencia', referencia: ' tr-123 ' })).referencia, 'TR-123');
});
test('CP3-06 método inválido y observación excesiva', () => {
  assert.throws(() => validarPago(body({ metodo: 'BITCOIN' })), UserError);
  assert.throws(() => validarPago(body({ observacion: 'x'.repeat(256) })), UserError);
});
test('CP3-07 referencia con caracteres peligrosos se rechaza', () => assert.throws(() => normalizarReferencia("'; DROP"), UserError));
test('CP3-08 motivo de anulación mínimo', () => {
  assert.throws(() => validarAnulacionPago({ motivo: 'no' }), UserError);
  assert.equal(validarAnulacionPago({ motivo: '  Error de digitación ' }).motivo, 'Error de digitación');
});
test('CP3-09 número de comprobante y periodos de cartera', () => {
  assert.equal(numeroComprobante(42), 'CP-000042');
  assert.deepEqual(periodosHasta('2026-02-01', 3), ['2025-12-01', '2026-01-01', '2026-02-01']);
});
test('CP3-10 configuración por defecto no inventa tarifa', () => {
  delete process.env.PAGO_VALOR_MENSUAL;
  assert.equal(configPagos().valorMensualReferencia, null);
});

// ---- Flujos API ----
test('CP3-11 operador registra pago y consulta comprobante; queda auditado', async () => {
  const e = await entorno();
  const r = await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body() });
  assert.equal(r.status, 201);
  assert.equal(r.data.pago.comprobante, 'CP-000001');
  const c = await e.req('/api/pagos/1/comprobante', { cookie: e.oper });
  assert.equal(c.status, 200);
  assert.equal(c.data.numero, 'CP-000001');
  assert.equal(c.data.placa, 'ABC123');
  assert.match(c.data.documentoInformativo, /No es factura/);
  assert.equal(e.st.auditoria.some(a => a.accion === 'REGISTRAR_PAGO'), true);
});
test('CP3-12 pago duplicado vehículo+periodo devuelve 409', async () => {
  const e = await entorno();
  await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body() });
  const r = await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body({ valor: 90000 }) });
  assert.equal(r.status, 409);
  assert.match(r.data.error, /Ya existe un pago/);
});
test('CP3-13 referencia repetida devuelve 409', async () => {
  const e = await entorno();
  const b = { metodo: 'TRANSFERENCIA', referencia: 'REF-001' };
  assert.equal((await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body(b) })).status, 201);
  const r = await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body({ ...b, vehiculoId: 2 }) });
  assert.equal(r.status, 409);
});
test('CP3-14 valor inválido, vehículo inexistente y cliente inactivo', async () => {
  const e = await entorno();
  assert.equal((await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body({ valor: -1 }) })).status, 400);
  assert.equal((await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body({ vehiculoId: 99 }) })).status, 404);
  assert.equal((await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body({ vehiculoId: 3 }) })).status, 409);
  assert.equal((await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body({ vehiculoId: '1 OR 1=1' }) })).status, 400);
});
test('CP3-15 sin sesión se rechaza con 401', async () => {
  const e = await entorno();
  assert.equal((await e.req('/api/pagos')).status, 401);
  assert.equal((await e.req('/api/pagos', { method: 'POST', body: body() })).status, 401);
});
test('CP3-16 solo ADMIN anula; OPERADOR recibe 403', async () => {
  const e = await entorno();
  await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body() });
  const no = await e.req('/api/pagos/1/anular', { method: 'POST', cookie: e.oper, body: { motivo: 'Error de digitación' } });
  assert.equal(no.status, 403);
  const sinMotivo = await e.req('/api/pagos/1/anular', { method: 'POST', cookie: e.admin, body: {} });
  assert.equal(sinMotivo.status, 400);
  const ok = await e.req('/api/pagos/1/anular', { method: 'POST', cookie: e.admin, body: { motivo: 'Error de digitación' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.pago.estado, 'ANULADO');
  const otra = await e.req('/api/pagos/1/anular', { method: 'POST', cookie: e.admin, body: { motivo: 'Segundo intento' } });
  assert.equal(otra.status, 409);
  assert.equal((await e.req('/api/pagos/77/anular', { method: 'POST', cookie: e.admin, body: { motivo: 'No existe' } })).status, 404);
});
test('CP3-17 tras anular, el mismo periodo puede registrarse de nuevo', async () => {
  const e = await entorno();
  await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body() });
  await e.req('/api/pagos/1/anular', { method: 'POST', cookie: e.admin, body: { motivo: 'Error de digitación' } });
  assert.equal((await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body() })).status, 201);
});
test('CP3-18 historial con filtros y filtros inválidos', async () => {
  const e = await entorno();
  await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body() });
  await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body({ vehiculoId: 2 }) });
  assert.equal((await e.req('/api/pagos', { cookie: e.oper })).data.length, 2);
  assert.equal((await e.req('/api/pagos?placa=moto', { cookie: e.oper })).data.length, 1);
  assert.equal((await e.req('/api/pagos?estado=ANULADO', { cookie: e.oper })).data.length, 0);
  assert.equal((await e.req('/api/pagos?estado=XX', { cookie: e.oper })).status, 400);
  assert.equal((await e.req('/api/pagos?periodo=2026-99', { cookie: e.oper })).status, 400);
});
test('CP3-19 cartera: vehículos sin pago; excluye clientes inactivos; baja al pagar', async () => {
  const e = await entorno();
  let c = await e.req('/api/pagos/cartera', { cookie: e.oper });
  assert.equal(c.status, 200);
  assert.deepEqual(c.data.pendientes.map(x => x.placa).sort(), ['ABC123', 'MOTO99']);
  await e.req('/api/pagos', { method: 'POST', cookie: e.oper, body: body() });
  c = await e.req('/api/pagos/cartera', { cookie: e.oper });
  assert.deepEqual(c.data.pendientes.map(x => x.placa), ['MOTO99']);
  await e.req('/api/pagos/1/anular', { method: 'POST', cookie: e.admin, body: { motivo: 'Error de digitación' } });
  assert.equal((await e.req('/api/pagos/cartera', { cookie: e.oper })).data.total, 2);
});
test('CP3-20 regresión: rutas de iteraciones previas siguen protegidas', async () => {
  const e = await entorno();
  assert.equal((await e.req('/api/usuarios', { cookie: e.oper })).status, 403);
  assert.equal((await e.req('/api/auditoria', { cookie: e.oper })).status, 403);
  assert.equal((await e.req('/api/pagos/config', { cookie: e.oper })).data.valorMensualReferencia, null);
});
