import test from 'node:test';
import assert from 'node:assert/strict';
import { Duplex } from 'node:stream';
import { IncomingMessage, ServerResponse } from 'node:http';
import bcrypt from 'bcryptjs';
import { crearApp } from '../src/app.js';
import { UserError, validarCambioCeldaOcupada } from '../src/validation.js';

process.env.SESSION_SECRET = 'clave_aleatoria_local_para_pruebas_de_sesion_segura_2026';

function invocarApp(app, path, { method = 'GET', body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const socket = new Duplex({
      read() { },
      write(_chunk, _enc, cb) {
        cb();
      },
    });
    socket.remoteAddress = '127.0.0.1';

    const req = new IncomingMessage(socket);
    req.method = method;
    req.url = path;
    req.headers = {
      host: 'localhost:3000',
      ...(payload ? { 'content-type': 'application/json', 'content-length': String(payload.length) } : {}),
      ...(cookie ? { cookie } : {}),
    };
    if (payload) {
      req.push(payload);
    }
    req.push(null);

    const res = new ServerResponse(req);
    res.assignSocket(socket);

    const chunks = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);
    res.write = (chunk, encoding, cb) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return origWrite(chunk, encoding, cb);
    };
    res.end = (chunk, encoding, cb) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      origEnd(chunk, encoding, cb);
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const setCookieHeader = res.getHeader('set-cookie');
        const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
        resolve({
          status: res.statusCode,
          data: raw ? JSON.parse(raw) : null,
          cookie: cookieStr ? String(cookieStr).split(';')[0] : null,
        });
      } catch (err) {
        reject(err);
      }
    };

    app(req, res);
  });
}

async function crearEntornoPruebas() {
  const hashInicial = await bcrypt.hash('Demo2026!', 8);
  const estado = {
    usuarios: [
      {
        id: 1,
        nombre: 'Administrador Demo',
        usuario: 'administrador',
        contrasena_hash: hashInicial,
        rol: 'ADMIN',
        activo: 1,
        creado_utc: '2026-11-01 10:00:00',
      },
      {
        id: 2,
        nombre: 'Operador Demo',
        usuario: 'operador',
        contrasena_hash: hashInicial,
        rol: 'OPERADOR',
        activo: 1,
        creado_utc: '2026-11-01 10:05:00',
      },
    ],
    clientes: [
      {
        id: 1,
        nombre: 'Cliente Uno',
        documento: 'DOC-001',
        telefono: '3000000001',
        correo: 'cliente1@example.test',
        activo: 1,
      },
    ],
    vehiculos: [
      {
        id: 1,
        cliente_id: 1,
        placa: 'ABC123',
        tipo: 'AUTOMOVIL',
        color: 'Gris',
        autorizado: 1,
        autorizacion_hasta: '2027-12-31',
      },
      {
        id: 2,
        cliente_id: 1,
        placa: 'MOTO99',
        tipo: 'MOTOCICLETA',
        color: 'Negro',
        autorizado: 1,
        autorizacion_hasta: '2027-12-31',
      },
    ],
    celdas: [
      { id: 1, codigo: 'C-001', tipo: 'MIXTA', habilitada: 1 },
      { id: 2, codigo: 'C-002', tipo: 'AUTOMOVIL', habilitada: 1 },
      { id: 3, codigo: 'C-005', tipo: 'MIXTA', habilitada: 0 },
    ],
    movimientos: [
      {
        id: 1,
        vehiculo_id: 1,
        celda_id: 1,
        usuario_entrada_id: 2,
        usuario_salida_id: null,
        fecha_entrada_utc: '2026-11-04 08:00:00',
        fecha_salida_utc: null,
        estado: 'ACTIVO',
      },
    ],
    auditoria: [],
  };

  const registrarAuditoria = (usuarioId, accion, entidad, registroId, detalles) => {
    const user = estado.usuarios.find(u => u.id === Number(usuarioId));
    estado.auditoria.unshift({
      id: estado.auditoria.length + 1,
      usuario_id: Number(usuarioId),
      accion,
      entidad,
      registro_id: Number(registroId),
      detalles,
      fecha_utc: '2026-11-04 12:00:00',
      operador: user?.nombre || 'Sistema',
      usuario_login: user?.usuario || 'sistema',
      rol_operador: user?.rol || 'ADMIN',
    });
  };

  const repo = {
    async obtenerUsuario(usuario) {
      return estado.usuarios.find(u => u.usuario === usuario) || null;
    },
    async usuarioActivo(id) {
      const u = estado.usuarios.find(x => x.id === Number(id) && x.activo === 1);
      return u ? { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol } : null;
    },
    async listarUsuarios({ q = '', rol = '', activo = '' } = {}) {
      return estado.usuarios
        .filter(u => {
          if (q && !`${u.nombre} ${u.usuario}`.toLowerCase().includes(q.toLowerCase())) return false;
          if (rol && u.rol !== rol) return false;
          if (activo !== '' && String(u.activo) !== String(activo)) return false;
          return true;
        })
        .map(({ contrasena_hash: _hash, ...safe }) => safe);
    },
    async crearUsuario({ nombre, usuario, contrasenaHash, rol, activo, adminId }) {
      if (estado.usuarios.some(u => u.usuario === usuario)) {
        throw new UserError('El usuario de acceso ya está registrado.', 409);
      }
      const nuevo = {
        id: estado.usuarios.length + 1,
        nombre,
        usuario,
        contrasena_hash: contrasenaHash,
        rol,
        activo,
        creado_utc: '2026-11-04 12:00:00',
      };
      estado.usuarios.push(nuevo);
      registrarAuditoria(adminId, 'CREAR_USUARIO', 'usuarios', nuevo.id, { usuario, rol, activo });
      return { id: nuevo.id, nombre, usuario, rol, activo };
    },
    async actualizarUsuario(id, cambios, adminId) {
      const actual = estado.usuarios.find(u => u.id === Number(id));
      if (!actual) throw new UserError('La cuenta de usuario no existe.', 404);
      const nuevoNombre = cambios.nombre ?? actual.nombre;
      const nuevoRol = cambios.rol ?? actual.rol;
      const nuevoActivo = cambios.activo ?? actual.activo;
      if (actual.rol === 'ADMIN' && actual.activo === 1 && (nuevoRol !== 'ADMIN' || nuevoActivo !== 1)) {
        const otrosAdmins = estado.usuarios.filter(u => u.rol === 'ADMIN' && u.activo === 1 && u.id !== actual.id);
        if (!otrosAdmins.length) {
          throw new UserError('No se puede desactivar ni cambiar el rol del último ADMIN activo.', 409);
        }
      }
      const accion =
        cambios.rol !== undefined && nuevoRol !== actual.rol
          ? 'CAMBIAR_ROL'
          : cambios.activo !== undefined && nuevoActivo !== actual.activo
            ? nuevoActivo === 1
              ? 'ACTIVAR_USUARIO'
              : 'DESACTIVAR_USUARIO'
            : 'ACTUALIZAR_USUARIO';
      actual.nombre = nuevoNombre;
      actual.rol = nuevoRol;
      actual.activo = nuevoActivo;
      registrarAuditoria(adminId, accion, 'usuarios', actual.id, {
        usuario: actual.usuario,
        rol: nuevoRol,
        activo: nuevoActivo,
      });
      return {
        id: actual.id,
        nombre: actual.nombre,
        usuario: actual.usuario,
        rol: actual.rol,
        activo: actual.activo,
        creado_utc: actual.creado_utc,
      };
    },
    async restablecerCredencialesUsuario(id, contrasenaHash, adminId) {
      const actual = estado.usuarios.find(u => u.id === Number(id));
      if (!actual) throw new UserError('La cuenta de usuario no existe.', 404);
      actual.contrasena_hash = contrasenaHash;
      registrarAuditoria(adminId, 'RESTABLECER_CREDENCIALES', 'usuarios', actual.id, { usuario: actual.usuario });
      return { id: actual.id, nombre: actual.nombre, usuario: actual.usuario, rol: actual.rol, activo: actual.activo };
    },
    async listarClientes({ q = '', activo = '' } = {}) {
      return estado.clientes
        .filter(c => {
          if (q && !`${c.nombre} ${c.documento}`.toLowerCase().includes(q.toLowerCase())) return false;
          if (activo !== '' && String(c.activo) !== String(activo)) return false;
          return true;
        })
        .map(c => ({
          ...c,
          total_vehiculos: estado.vehiculos.filter(v => v.cliente_id === c.id).length,
        }));
    },
    async detalleCliente(id) {
      const c = estado.clientes.find(x => x.id === Number(id));
      if (!c) return null;
      const vehiculos = estado.vehiculos.filter(v => v.cliente_id === c.id);
      return { ...c, total_vehiculos: vehiculos.length, vehiculos };
    },
    async crearCliente({ nombre, documento, telefono, correo, activo, usuarioId }) {
      if (estado.clientes.some(c => c.documento === documento)) {
        throw new UserError('Documento duplicado: ya pertenece a otro cliente.', 409);
      }
      const nuevo = { id: estado.clientes.length + 1, nombre, documento, telefono, correo, activo };
      estado.clientes.push(nuevo);
      registrarAuditoria(usuarioId, 'REGISTRAR_CLIENTE', 'clientes', nuevo.id, { nombre, documento });
      return { ...nuevo, total_vehiculos: 0 };
    },
    async actualizarCliente(id, cambios, usuarioId) {
      const actual = estado.clientes.find(c => c.id === Number(id));
      if (!actual) throw new UserError('El cliente seleccionado no existe.', 404);
      const nuevoDoc = cambios.documento ?? actual.documento;
      if (nuevoDoc !== actual.documento && estado.clientes.some(c => c.documento === nuevoDoc && c.id !== actual.id)) {
        throw new UserError('Documento duplicado: ya pertenece a otro cliente.', 409);
      }
      actual.nombre = cambios.nombre ?? actual.nombre;
      actual.documento = nuevoDoc;
      if (cambios.telefono !== undefined) actual.telefono = cambios.telefono;
      if (cambios.correo !== undefined) actual.correo = cambios.correo;
      if (cambios.activo !== undefined) actual.activo = cambios.activo;
      registrarAuditoria(usuarioId, 'ACTUALIZAR_CLIENTE', 'clientes', actual.id, { documento: actual.documento });
      return {
        ...actual,
        total_vehiculos: estado.vehiculos.filter(v => v.cliente_id === actual.id).length,
      };
    },
    async consultarVehiculos(placa = '') {
      return estado.vehiculos
        .filter(v => !placa || v.placa.includes(placa))
        .map(v => {
          const c = estado.clientes.find(x => x.id === v.cliente_id);
          return {
            ...v,
            cliente: c?.nombre || '',
            cliente_activo: c?.activo ?? 0,
            vigente: v.autorizado === 1 && c?.activo === 1 ? 1 : 0,
          };
        });
    },
    async consultarCeldas(opciones = '') {
      const enriquecidas = estado.celdas.map(c => {
        const mov = estado.movimientos.find(m => m.celda_id === c.id && m.estado === 'ACTIVO');
        const veh = mov ? estado.vehiculos.find(v => v.id === mov.vehiculo_id) : null;
        return {
          ...c,
          estado_ocupacion: mov ? 'OCUPADA' : c.habilitada === 0 ? 'INHABILITADA' : 'DISPONIBLE',
          movimiento_activo_id: mov?.id || null,
          placa_actual: veh?.placa || null,
          tipo_vehiculo_actual: veh?.tipo || null,
        };
      });
      if (!opciones || typeof opciones === 'string') return enriquecidas;
      return enriquecidas.filter(c => {
        if (opciones.tipoExacto && c.tipo !== opciones.tipoExacto) return false;
        if (opciones.estadoOcupacion && c.estado_ocupacion !== opciones.estadoOcupacion) return false;
        if (opciones.habilitada !== '' && opciones.habilitada !== undefined) {
          if (String(c.habilitada) !== String(opciones.habilitada)) return false;
        }
        return true;
      });
    },
    async crearCelda({ codigo, tipo, habilitada, usuarioId }) {
      if (estado.celdas.some(c => c.codigo === codigo)) {
        throw new UserError('El código de celda ya existe, incluso si está deshabilitada.', 409);
      }
      const nueva = { id: estado.celdas.length + 1, codigo, tipo, habilitada };
      estado.celdas.push(nueva);
      registrarAuditoria(usuarioId, 'CREAR_CELDA', 'celdas', nueva.id, { codigo, tipo, habilitada });
      return {
        ...nueva,
        estado_ocupacion: habilitada === 1 ? 'DISPONIBLE' : 'INHABILITADA',
        movimiento_activo_id: null,
        placa_actual: null,
      };
    },
    async actualizarCelda(id, cambios, usuarioId) {
      const celda = estado.celdas.find(c => c.id === Number(id));
      if (!celda) throw new UserError('La celda indicada no existe.', 404);
      const mov = estado.movimientos.find(m => m.celda_id === celda.id && m.estado === 'ACTIVO');
      const veh = mov ? estado.vehiculos.find(v => v.id === mov.vehiculo_id) : null;
      const actual = {
        ...celda,
        estado_ocupacion: mov ? 'OCUPADA' : celda.habilitada === 0 ? 'INHABILITADA' : 'DISPONIBLE',
        movimiento_activo_id: mov?.id || null,
        placa_actual: veh?.placa || null,
        tipo_vehiculo_actual: veh?.tipo || null,
      };
      validarCambioCeldaOcupada(actual, cambios);
      const nuevoCodigo = cambios.codigo ?? celda.codigo;
      if (nuevoCodigo !== celda.codigo && estado.celdas.some(c => c.codigo === nuevoCodigo && c.id !== celda.id)) {
        throw new UserError('El código de celda ya existe, incluso si está deshabilitada.', 409);
      }
      celda.codigo = nuevoCodigo;
      celda.tipo = cambios.tipo ?? celda.tipo;
      celda.habilitada = cambios.habilitada ?? celda.habilitada;
      registrarAuditoria(usuarioId, 'ACTUALIZAR_CELDA', 'celdas', celda.id, {
        codigo: celda.codigo,
        tipo: celda.tipo,
        habilitada: celda.habilitada,
      });
      return {
        ...celda,
        estado_ocupacion: mov ? 'OCUPADA' : celda.habilitada === 0 ? 'INHABILITADA' : 'DISPONIBLE',
        movimiento_activo_id: mov?.id || null,
        placa_actual: veh?.placa || null,
      };
    },
    async registrarEntrada(placa, codigoCelda, usuarioId) {
      const veh = estado.vehiculos.find(v => v.placa === placa);
      const cel = estado.celdas.find(c => c.codigo === codigoCelda);
      if (!veh || !cel || cel.habilitada !== 1) throw new UserError('Vehículo o celda no habilitados', 409);
      const id = estado.movimientos.length + 1;
      estado.movimientos.push({
        id,
        vehiculo_id: veh.id,
        celda_id: cel.id,
        usuario_entrada_id: usuarioId,
        usuario_salida_id: null,
        fecha_entrada_utc: '2026-11-04 12:10:00',
        fecha_salida_utc: null,
        estado: 'ACTIVO',
      });
      return id;
    },
    async listarAuditoria({ entidad = '' } = {}) {
      return estado.auditoria.filter(a => !entidad || a.entidad === entidad);
    },
    async consultarPanel() {
      return {
        total: estado.celdas.filter(c => c.habilitada === 1).length,
        ocupadas: estado.movimientos.filter(m => m.estado === 'ACTIVO').length,
        disponibles: 1,
        entradas_hoy: 1,
        cuentas_activas: estado.usuarios.filter(u => u.activo === 1).length,
        clientes_total: estado.clientes.length,
      };
    },
  };

  const app = crearApp(repo, { query: async () => [[{ 1: 1 }]] });
  return {
    estado,
    request: (path, opts) => invocarApp(app, path, opts),
  };
}

test('Flujo integral Iteración 2: Cuentas, Permisos, Clientes, Celdas y Auditoría', async () => {
  const env = await crearEntornoPruebas();

  // 1. Login como ADMIN y como OPERADOR
  const loginAdmin = await env.request('/api/auth/login', {
    method: 'POST',
    body: { usuario: 'administrador', contrasena: 'Demo2026!' },
  });
  assert.equal(loginAdmin.status, 200);
  const adminCookie = loginAdmin.cookie;

  const loginOperador = await env.request('/api/auth/login', {
    method: 'POST',
    body: { usuario: 'operador', contrasena: 'Demo2026!' },
  });
  assert.equal(loginOperador.status, 200);
  const operadorCookie = loginOperador.cookie;

  // CP2-01 & CPN2-02: Consultar cuentas sin exponer contrasena_hash
  const listadoCuentas = await env.request('/api/usuarios?q=operador', { cookie: adminCookie });
  assert.equal(listadoCuentas.status, 200);
  assert.equal(listadoCuentas.data.length, 1);
  assert.equal(listadoCuentas.data[0].usuario, 'operador');
  assert.equal('contrasena_hash' in listadoCuentas.data[0], false);

  // CP2-02 & EA2-01: ADMIN crea cuenta OPERADOR con hash bcrypt y auditoría
  const crearCuenta = await env.request('/api/usuarios', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      nombre: 'Mariana Rodríguez',
      usuario: 'mrodriguez',
      contrasena: 'ClaveSegura2026!',
      rol: 'OPERADOR',
      activo: true,
    },
  });
  assert.equal(crearCuenta.status, 201);
  assert.equal(crearCuenta.data.usuario.usuario, 'mrodriguez');
  const guardadaEnEstado = env.estado.usuarios.find(u => u.usuario === 'mrodriguez');
  assert.notEqual(guardadaEnEstado.contrasena_hash, 'ClaveSegura2026!');
  assert.equal(await bcrypt.compare('ClaveSegura2026!', guardadaEnEstado.contrasena_hash), true);

  // CP2-07: Prevenir cuentas duplicadas
  const cuentaDuplicada = await env.request('/api/usuarios', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      nombre: 'Otra Mariana',
      usuario: 'mrodriguez',
      contrasena: 'ClaveSegura2026!',
      rol: 'OPERADOR',
    },
  });
  assert.equal(cuentaDuplicada.status, 409);

  // CP2-08 & EA2-02: OPERADOR no puede crear ni modificar cuentas (403)
  const operadorIntentaCrear = await env.request('/api/usuarios', {
    method: 'POST',
    cookie: operadorCookie,
    body: {
      nombre: 'Intruso',
      usuario: 'intruso',
      contrasena: 'ClaveSegura2026!',
      rol: 'ADMIN',
    },
  });
  assert.equal(operadorIntentaCrear.status, 403);

  const operadorIntentaRol = await env.request('/api/usuarios/2', {
    method: 'PATCH',
    cookie: operadorCookie,
    body: { rol: 'ADMIN' },
  });
  assert.equal(operadorIntentaRol.status, 403);

  // RN2-05: Impedir desactivar o degradar al último ADMIN activo
  const desactivarUltimoAdmin = await env.request('/api/usuarios/1', {
    method: 'PATCH',
    cookie: adminCookie,
    body: { activo: false },
  });
  assert.equal(desactivarUltimoAdmin.status, 409);

  // CP2-03 & CP2-04: Actualizar datos y rol de cuenta
  const editarCuenta = await env.request(`/api/usuarios/${crearCuenta.data.usuario.id}`, {
    method: 'PUT',
    cookie: adminCookie,
    body: { nombre: 'Mariana R. Actualizada', rol: 'OPERADOR', activo: true },
  });
  assert.equal(editarCuenta.status, 200);
  assert.equal(editarCuenta.data.usuario.nombre, 'Mariana R. Actualizada');

  // CP2-06: Restablecer credenciales y verificar login con la nueva contraseña
  const resetClave = await env.request(`/api/usuarios/${crearCuenta.data.usuario.id}/credenciales`, {
    method: 'PATCH',
    cookie: adminCookie,
    body: { contrasena: 'NuevaClave999!', confirmacion: 'NuevaClave999!' },
  });
  assert.equal(resetClave.status, 200);

  const loginMariana = await env.request('/api/auth/login', {
    method: 'POST',
    body: { usuario: 'mrodriguez', contrasena: 'NuevaClave999!' },
  });
  assert.equal(loginMariana.status, 200);
  const marianaCookie = loginMariana.cookie;

  // CP2-05, EA2-03 & CPN2-12: Desactivar cuenta impide nuevo login y bloquea sesión existente
  const desactivarMariana = await env.request(`/api/usuarios/${crearCuenta.data.usuario.id}`, {
    method: 'PATCH',
    cookie: adminCookie,
    body: { activo: false },
  });
  assert.equal(desactivarMariana.status, 200);

  const sesionBloqueada = await env.request('/api/auth/me', { cookie: marianaCookie });
  assert.equal(sesionBloqueada.status, 401);

  const loginInactivo = await env.request('/api/auth/login', {
    method: 'POST',
    body: { usuario: 'mrodriguez', contrasena: 'NuevaClave999!' },
  });
  assert.equal(loginInactivo.status, 401);

  // CP2-09 a CP2-13 & EA2-04: Gestión de clientes mensualistas
  const crearCliente = await env.request('/api/clientes', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      nombre: 'Valentina Osorio',
      documento: '1015346289',
      telefono: '300 452 9081',
      correo: 'valentina@ejemplo.com',
      activo: true,
    },
  });
  assert.equal(crearCliente.status, 201);

  const clienteDuplicado = await env.request('/api/clientes', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      nombre: 'Otro Cliente',
      documento: '1015346289',
    },
  });
  assert.equal(clienteDuplicado.status, 409);

  // OPERADOR puede consultar clientes pero no crear/editar
  const clientesOperador = await env.request('/api/clientes?q=Valentina', { cookie: operadorCookie });
  assert.equal(clientesOperador.status, 200);
  assert.equal(clientesOperador.data.length, 1);

  const operadorIntentaCrearCliente = await env.request('/api/clientes', {
    method: 'POST',
    cookie: operadorCookie,
    body: { nombre: 'No Autorizado', documento: '9999999' },
  });
  assert.equal(operadorIntentaCrearCliente.status, 403);

  // CP2-11 & CP2-12: Actualizar cliente y desactivar conservando vehículos
  const desactivarClienteConVehiculo = await env.request('/api/clientes/1', {
    method: 'PATCH',
    cookie: adminCookie,
    body: { activo: false },
  });
  assert.equal(desactivarClienteConVehiculo.status, 200);
  assert.equal(desactivarClienteConVehiculo.data.cliente.total_vehiculos, 2);

  // CP2-14 a CP2-22 & EA2-05 a EA2-08: Gestión de celdas y protección de ocupación
  const crearCelda = await env.request('/api/celdas', {
    method: 'POST',
    cookie: adminCookie,
    body: { codigo: 'QA-C01', tipo: 'MIXTA', habilitada: true },
  });
  assert.equal(crearCelda.status, 201);
  assert.equal(crearCelda.data.celda.estado_ocupacion, 'DISPONIBLE');

  // CP2-21: Impedir código repetido incluso si está deshabilitada (C-005 está deshabilitada)
  const celdaDuplicada = await env.request('/api/celdas', {
    method: 'POST',
    cookie: adminCookie,
    body: { codigo: 'C-005', tipo: 'MIXTA', habilitada: true },
  });
  assert.equal(celdaDuplicada.status, 409);

  // CP2-16 & EA2-08: Cambiar tipo de celda desocupada
  const editarCeldaLibre = await env.request(`/api/celdas/${crearCelda.data.celda.id}`, {
    method: 'PUT',
    cookie: adminCookie,
    body: { codigo: 'QA-C01', tipo: 'AUTOMOVIL', habilitada: true },
  });
  assert.equal(editarCeldaLibre.status, 200);
  assert.equal(editarCeldaLibre.data.celda.tipo, 'AUTOMOVIL');

  // CP2-18 & EA2-06: Bloquear deshabilitación de celda ocupada (C-001 tiene movimiento activo)
  const deshabilitarCeldaOcupada = await env.request('/api/celdas/1', {
    method: 'PATCH',
    cookie: adminCookie,
    body: { habilitada: false },
  });
  assert.equal(deshabilitarCeldaOcupada.status, 409);

  // CP2-20: Validar compatibilidad vehículo-celda al registrar entrada (MOTO99 en celda AUTOMOVIL C-002)
  const entradaIncompatible = await env.request('/api/movimientos/entrada', {
    method: 'POST',
    cookie: operadorCookie,
    body: { placa: 'MOTO99', codigoCelda: 'C-002' },
  });
  assert.equal(entradaIncompatible.status, 400);
  assert.match(entradaIncompatible.data.error, /no admite ese tipo/);

  // CP2-22 & CPN2-09: Consultar auditoría administrativa
  const auditoria = await env.request('/api/auditoria', { cookie: adminCookie });
  assert.equal(auditoria.status, 200);
  assert.equal(auditoria.data.some(a => a.accion === 'CREAR_USUARIO'), true);
  assert.equal(auditoria.data.some(a => a.accion === 'RESTABLECER_CREDENCIALES'), true);
  assert.equal(auditoria.data.some(a => a.accion === 'REGISTRAR_CLIENTE'), true);
  assert.equal(auditoria.data.some(a => a.accion === 'CREAR_CELDA'), true);
});
