import express from 'express';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import {pool} from './db.js';
import * as defaultRepo from './repository.js';
import {cookieOptions, extraerCookie, generarToken, verificarToken} from './session.js';
import {
  UserError,
  ESTADOS,
  ROLES_USUARIO,
  TIPOS_CELDA,
  ESTADOS_OCUPACION,
  normalizarPlaca,
  normalizarCelda,
  parseId,
  validarFechas,
  validarNovedad,
  validarVehiculo,
  compatibleConCelda,
  validarCuentaCrear,
  validarCuentaActualizar,
  validarCredenciales,
  validarClienteCrear,
  validarClienteActualizar,
  validarCeldaCrear,
  validarCeldaActualizar,
} from './validation.js';

export function crearApp(repo = defaultRepo, dbPool = pool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy: false}));
  app.use(express.json({limit: '24kb'}));

  // La interfaz usa proxy Vite para el mismo origen. Rechazar cambios desde orígenes ajenos.
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.get('origin');
      const host = req.get('host');
      if (origin) {
        try {
          if (new URL(origin).host !== host) return res.status(403).json({error: 'Origen no autorizado'});
        } catch {
          return res.status(403).json({error: 'Origen inválido'});
        }
      }
    }
    next();
  });

  const intentos = new Map();

  app.get('/api/health', async (_req, res, next) => {
    try {
      await dbPool.query('SELECT 1');
      res.json({ok: true, db: 'conectada'});
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const usuario = String(req.body.usuario || '').trim().toLowerCase();
      const contrasena = String(req.body.contrasena || '');
      if (!usuario || usuario.length > 60 || !contrasena) {
        throw new UserError('Usuario y contraseña obligatorios');
      }
      const key = req.ip || 'local';
      const hit = intentos.get(key) || {n: 0, until: 0};
      if (hit.until > Date.now()) {
        throw new UserError('Demasiados intentos; prueba después.', 429);
      }
      const user = await repo.obtenerUsuario(usuario);
      const valid = user?.activo === 1 && (await bcrypt.compare(contrasena, user.contrasena_hash));
      if (!valid) {
        hit.n++;
        if (hit.n >= 6) {
          hit.until = Date.now() + 10 * 60 * 1000;
          hit.n = 0;
        }
        intentos.set(key, hit);
        throw new UserError('Credenciales incorrectas o cuenta inactiva', 401);
      }
      intentos.delete(key);
      res.cookie('autos_session', generarToken(user), cookieOptions);
      res.json({usuario: {id: user.id, nombre: user.nombre, usuario: user.usuario, rol: user.rol}});
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('autos_session', {...cookieOptions, maxAge: undefined});
    res.json({ok: true});
  });

  async function requiereSesion(req, _res, next) {
    try {
      const payload = verificarToken(extraerCookie(req));
      if (!payload) throw new UserError('La sesión expiró. Ingresa nuevamente.', 401);
      const user = await repo.usuarioActivo(payload.sub);
      if (!user) throw new UserError('Acceso no autorizado o cuenta desactivada.', 401);
      req.user = user;
      next();
    } catch (e) {
      next(e);
    }
  }

  app.use('/api', requiereSesion);

  const requiereRol =
    (...roles) =>
    (req, _res, next) => {
      try {
        if (!roles.includes(req.user.rol)) {
          throw new UserError('No tienes permiso para realizar esta operación.', 403);
        }
        next();
      } catch (e) {
        next(e);
      }
    };

  app.get('/api/auth/me', (req, res) => res.json({usuario: req.user}));

  app.get('/api/dashboard', async (_req, res, next) => {
    try {
      res.json(await repo.consultarPanel());
    } catch (e) {
      next(e);
    }
  });

  // =========================================================================
  // ITERACIÓN 2 · MÓDULO 1: GESTIÓN DE CUENTAS DE ACCESO (RF2-U01 a RF2-U08)
  // =========================================================================
  app.get('/api/usuarios', requiereRol('ADMIN'), async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim().slice(0, 80);
      const rol = req.query.rol ? String(req.query.rol).trim().toUpperCase() : '';
      if (rol && !ROLES_USUARIO.has(rol)) throw new UserError('Filtro de rol no válido.');
      const activo =
        req.query.activo !== undefined && req.query.activo !== ''
          ? String(req.query.activo) === '1' || String(req.query.activo) === 'true'
            ? '1'
            : '0'
          : '';
      res.json(await repo.listarUsuarios({q, rol, activo}));
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/usuarios', requiereRol('ADMIN'), async (req, res, next) => {
    try {
      const datos = validarCuentaCrear(req.body || {});
      const contrasenaHash = await bcrypt.hash(datos.contrasena, 12);
      const cuenta = await repo.crearUsuario({
        nombre: datos.nombre,
        usuario: datos.usuario,
        contrasenaHash,
        rol: datos.rol,
        activo: datos.activo,
        adminId: req.user.id,
      });
      res.status(201).json({
        ok: true,
        mensaje: 'Cuenta de acceso creada correctamente.',
        usuario: cuenta,
      });
    } catch (e) {
      next(e);
    }
  });

  const actualizarCuentaHandler = async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const cambios = validarCuentaActualizar(req.body || {});
      const cuenta = await repo.actualizarUsuario(id, cambios, req.user.id);
      res.json({
        ok: true,
        mensaje: 'Cuenta actualizada correctamente.',
        usuario: cuenta,
      });
    } catch (e) {
      next(e);
    }
  };
  app.put('/api/usuarios/:id', requiereRol('ADMIN'), actualizarCuentaHandler);
  app.patch('/api/usuarios/:id', requiereRol('ADMIN'), actualizarCuentaHandler);

  const restablecerCredencialesHandler = async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const {contrasena} = validarCredenciales(req.body || {});
      const contrasenaHash = await bcrypt.hash(contrasena, 12);
      const cuenta = await repo.restablecerCredencialesUsuario(id, contrasenaHash, req.user.id);
      res.json({
        ok: true,
        mensaje: 'Credenciales restablecidas correctamente.',
        usuario: cuenta,
      });
    } catch (e) {
      next(e);
    }
  };
  app.patch('/api/usuarios/:id/credenciales', requiereRol('ADMIN'), restablecerCredencialesHandler);
  app.put('/api/usuarios/:id/credenciales', requiereRol('ADMIN'), restablecerCredencialesHandler);

  // =========================================================================
  // ITERACIÓN 2 · MÓDULO 2: GESTIÓN DE CLIENTES MENSUALISTAS (RF2-CL01 a CL05)
  // =========================================================================
  app.get('/api/clientes', requiereRol('ADMIN', 'OPERADOR'), async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim().slice(0, 80);
      const activo =
        req.query.activo !== undefined && req.query.activo !== ''
          ? String(req.query.activo) === '1' || String(req.query.activo) === 'true'
            ? '1'
            : '0'
          : '';
      res.json(await repo.listarClientes({q, activo}));
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/clientes/:id', requiereRol('ADMIN', 'OPERADOR'), async (req, res, next) => {
    try {
      const cliente = await repo.detalleCliente(parseId(req.params.id));
      if (!cliente) throw new UserError('Cliente no encontrado.', 404);
      res.json(cliente);
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/clientes', requiereRol('ADMIN'), async (req, res, next) => {
    try {
      const datos = validarClienteCrear(req.body || {});
      const cliente = await repo.crearCliente({...datos, usuarioId: req.user.id});
      res.status(201).json({
        ok: true,
        mensaje: 'Cliente registrado correctamente.',
        cliente,
      });
    } catch (e) {
      next(e);
    }
  });

  const actualizarClienteHandler = async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const cambios = validarClienteActualizar(req.body || {});
      const cliente = await repo.actualizarCliente(id, cambios, req.user.id);
      res.json({
        ok: true,
        mensaje: 'Datos del cliente actualizados correctamente.',
        cliente,
      });
    } catch (e) {
      next(e);
    }
  };
  app.put('/api/clientes/:id', requiereRol('ADMIN'), actualizarClienteHandler);
  app.patch('/api/clientes/:id', requiereRol('ADMIN'), actualizarClienteHandler);

  // =========================================================================
  // ITERACIÓN 1 · VEHÍCULOS
  // =========================================================================
  app.get('/api/vehiculos', async (req, res, next) => {
    try {
      const placa = req.query.placa
        ? String(req.query.placa)
            .toUpperCase()
            .replace(/[^A-Z0-9-]/g, '')
            .slice(0, 10)
        : '';
      res.json(await repo.consultarVehiculos(placa));
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/vehiculos', requiereRol('ADMIN', 'OPERADOR'), async (req, res, next) => {
    try {
      const datos = validarVehiculo(req.body);
      const vehiculo = await repo.registrarVehiculo({...datos, usuarioId: req.user.id});
      res.status(201).json({ok: true, mensaje: 'Vehículo registrado correctamente', vehiculo});
    } catch (e) {
      next(e);
    }
  });

  // =========================================================================
  // ITERACIÓN 1 Y 2 · MÓDULO 3: CELDAS Y DISPONIBILIDAD (RF2-C01 a RF2-C09)
  // =========================================================================
  app.get('/api/celdas', requiereRol('ADMIN', 'OPERADOR'), async (req, res, next) => {
    try {
      const tipo = req.query.tipo ? String(req.query.tipo).trim().toUpperCase() : '';
      const tipoExacto = req.query.tipoExacto ? String(req.query.tipoExacto).trim().toUpperCase() : '';
      if (tipoExacto && !TIPOS_CELDA.has(tipoExacto)) {
        throw new UserError('Tipo de celda no válido.');
      }
      const estadoOcupacion = req.query.estadoOcupacion || req.query.ocupacion
        ? String(req.query.estadoOcupacion || req.query.ocupacion).trim().toUpperCase()
        : '';
      if (estadoOcupacion && !ESTADOS_OCUPACION.has(estadoOcupacion)) {
        throw new UserError('Estado de ocupación no válido.');
      }
      const habilitada =
        req.query.habilitada !== undefined && req.query.habilitada !== ''
          ? String(req.query.habilitada) === '1' || String(req.query.habilitada) === 'true'
            ? '1'
            : '0'
          : '';
      const q = String(req.query.q || '').trim().slice(0, 30);
      const disponibles = req.query.disponibles === '1' ? '1' : '';

      const rows = await repo.consultarCeldas({
        tipo,
        tipoExacto,
        estadoOcupacion,
        habilitada,
        q,
        disponibles,
      });
      res.json(disponibles === '1' ? rows.filter(x => x.estado_ocupacion === 'DISPONIBLE') : rows);
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/celdas', requiereRol('ADMIN'), async (req, res, next) => {
    try {
      const datos = validarCeldaCrear(req.body || {});
      const celda = await repo.crearCelda({...datos, usuarioId: req.user.id});
      res.status(201).json({
        ok: true,
        mensaje: 'Celda registrada correctamente.',
        celda,
      });
    } catch (e) {
      next(e);
    }
  });

  const actualizarCeldaHandler = async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const cambios = validarCeldaActualizar(req.body || {});
      const celda = await repo.actualizarCelda(id, cambios, req.user.id);
      res.json({
        ok: true,
        mensaje: 'Celda actualizada correctamente.',
        celda,
      });
    } catch (e) {
      next(e);
    }
  };
  app.put('/api/celdas/:id', requiereRol('ADMIN'), actualizarCeldaHandler);
  app.patch('/api/celdas/:id', requiereRol('ADMIN'), actualizarCeldaHandler);

  // =========================================================================
  // ITERACIÓN 1 · MOVIMIENTOS, NOVEDADES Y AUDITORÍA
  // =========================================================================
  app.get('/api/movimientos', async (req, res, next) => {
    try {
      const estado = String(req.query.estado || '').toUpperCase();
      if (estado && !ESTADOS.has(estado)) throw new UserError('Estado desconocido');
      const placa = String(req.query.placa || '')
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '')
        .slice(0, 10);
      const fechas = validarFechas({
        desde: req.query.desde ? String(req.query.desde) : '',
        hasta: req.query.hasta ? String(req.query.hasta) : '',
      });
      res.json(await repo.listarMovimientos({estado, placa, ...fechas}));
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/movimientos/:id', async (req, res, next) => {
    try {
      const info = await repo.detalleMovimiento(parseId(req.params.id));
      if (!info) throw new UserError('Movimiento no encontrado', 404);
      res.json(info);
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/movimientos/entrada', async (req, res, next) => {
    try {
      const placa = normalizarPlaca(req.body.placa);
      const celda = normalizarCelda(req.body.codigoCelda);
      const vehiculos = await repo.consultarVehiculos(placa);
      const vehiculo = vehiculos.find(v => v.placa === placa);
      const celdas = await repo.consultarCeldas();
      const espacio = celdas.find(c => c.codigo === celda);
      if (vehiculo && espacio && !compatibleConCelda(vehiculo.tipo, espacio.tipo)) {
        throw new UserError('La celda no admite ese tipo de vehículo.');
      }
      const id = await repo.registrarEntrada(placa, celda, req.user.id);
      res.status(201).json({ok: true, id, mensaje: 'Entrada registrada correctamente'});
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/movimientos/:id/salida', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      await repo.registrarSalida(id, req.user.id);
      res.json({ok: true, id, mensaje: 'Salida registrada y celda liberada'});
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/novedades', async (_req, res, next) => {
    try {
      res.json(await repo.listarNovedades());
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/novedades', async (req, res, next) => {
    try {
      const data = validarNovedad(req.body);
      await repo.registrarNovedad({...data, usuarioId: req.user.id});
      res.status(201).json({ok: true, mensaje: 'Novedad registrada'});
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/auditoria', requiereRol('ADMIN'), async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim().slice(0, 80);
      const entidad = String(req.query.entidad || '').trim().toLowerCase().slice(0, 40);
      const accion = String(req.query.accion || '').trim().toUpperCase().slice(0, 50);
      const dias = req.query.dias ? String(req.query.dias).trim() : '';
      const fechas = validarFechas({
        desde: req.query.desde ? String(req.query.desde) : '',
        hasta: req.query.hasta ? String(req.query.hasta) : '',
      });
      res.json(await repo.listarAuditoria({q, entidad, accion, dias, ...fechas}));
    } catch (e) {
      next(e);
    }
  });

  app.use('/api', (_req, res) => res.status(404).json({error: 'Ruta no encontrada'}));

  app.use((err, _req, res, _next) => {
    if (err instanceof UserError) return res.status(err.status).json({error: err.message});
    const msg = String(err?.sqlMessage || err?.message || '');
    if (err?.code === 'ER_DUP_ENTRY') {
      if (msg.includes('uq_vehiculos_placa')) {
        return res.status(409).json({error: 'La placa ya está registrada.'});
      }
      if (msg.includes('uq_usuarios_usuario')) {
        return res.status(409).json({error: 'El usuario de acceso ya está registrado.'});
      }
      if (msg.includes('uq_clientes_documento')) {
        return res.status(409).json({error: 'Documento duplicado: ya pertenece a otro cliente.'});
      }
      if (msg.includes('uq_celdas_codigo')) {
        return res.status(409).json({error: 'El código de celda ya existe, incluso si está deshabilitada.'});
      }
      return res.status(409).json({error: 'Ya existe un registro con ese identificador único. Actualiza la lista.'});
    }
    if (err?.sqlState === '45000' || err?.errno === 1644) {
      return res.status(409).json({error: err.sqlMessage || 'Operación rechazada por las reglas del parqueadero'});
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({error: 'Solicitud demasiado grande'});
    }
    console.error('Error interno API:', err);
    res.status(500).json({error: 'No fue posible completar la operación. Comprueba la conexión y los procedimientos SQL.'});
  });

  return app;
}

export const app = crearApp();
