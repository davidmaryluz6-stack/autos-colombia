<script setup>
import {onMounted, ref, computed} from 'vue';
import {api, formatearFecha, tiempo} from './api';

const navOperacion = [
  {id: 'panel', icon: '▦', label: 'Panel principal'},
  {id: 'registroVehiculo', icon: '+', label: 'Registrar vehículo'},
  {id: 'entrada', icon: '↗', label: 'Registrar entrada'},
  {id: 'activos', icon: '▤', label: 'Vehículos dentro'},
  {id: 'salida', icon: '↘', label: 'Registrar salida'},
  {id: 'historial', icon: '◷', label: 'Historial'},
  {id: 'novedades', icon: '◎', label: 'Novedades'},
];

const pagina = ref('panel');
const sesion = ref(null);
const cargando = ref(true);
const trabajando = ref(false);
const mensaje = ref(null);
const detalle = ref(null);
const detalleClienteModal = ref(null);
const detalleCeldaModal = ref(null);

const login = ref({usuario: '', contrasena: ''});
const panel = ref({
  total: 0,
  inhabilitadas: 0,
  total_celdas: 0,
  ocupadas: 0,
  disponibles: 0,
  entradas_hoy: 0,
  cuentas_activas: 0,
  admins_activos: 0,
  operadores_activos: 0,
  cuentas_inactivas: 0,
  clientes_total: 0,
  clientes_activos: 0,
  clientes_inactivos: 0,
  eventos_hoy: 0,
});

const activos = ref([]);
const celdas = ref([]);
const historial = ref([]);
const novedades = ref([]);
const auditoria = ref([]);
const cuentas = ref([]);
const clientes = ref([]);

// Iteración 1: Operación vehicular
const entrada = ref({placa: '', codigoCelda: ''});
const salida = ref({placa: ''});
const novedad = ref({movimientoId: '', tipo: 'OBSERVACION', descripcion: ''});
const vehiculoRegistrado = ref(null);
const nuevoVehiculo = ref({
  placa: '',
  tipo: 'AUTOMOVIL',
  color: '',
  clienteId: '',
  autorizado: true,
  autorizacionHasta: '',
});
const filtrado = ref({placa: '', estado: '', desde: '', hasta: ''});
const vehiculoActual = ref(null);

// Iteración 2 · Módulo 1: Cuentas de acceso (D02, D03, D04, D05)
const vistaCuentas = ref('listado'); // 'listado' | 'crear' | 'editar' | 'credenciales'
const filtroCuentas = ref({q: '', rol: '', activo: ''});
const nuevaCuenta = ref({nombre: '', usuario: '', rol: 'OPERADOR', contrasena: '', activo: true});
const cuentaEditando = ref(null);
const formEditarCuenta = ref({id: '', nombre: '', usuario: '', rol: 'OPERADOR', activo: true});
const formCredenciales = ref({contrasena: '', confirmacion: ''});

// Iteración 2 · Módulo 2: Clientes mensualistas (D06, D07, D08)
const vistaClientes = ref('listado'); // 'listado' | 'crear' | 'editar'
const filtroClientes = ref({q: '', activo: ''});
const nuevoCliente = ref({nombre: '', documento: '', telefono: '', correo: '', activo: true});
const clienteEditando = ref(null);
const formEditarCliente = ref({id: '', nombre: '', documento: '', telefono: '', correo: '', activo: true});

// Iteración 2 · Módulo 3: Gestión de celdas y disponibilidad (D09, D10, D11, D12, D14)
const vistaCeldas = ref('mapa'); // 'mapa' | 'crear' | 'editar' | 'bloqueo'
const filtroCeldas = ref({tipoExacto: '', estadoOcupacion: '', habilitada: '', q: ''});
const nuevaCelda = ref({codigo: '', tipo: 'MIXTA', habilitada: true});
const celdaEditando = ref(null);
const formEditarCelda = ref({id: '', codigo: '', tipo: 'MIXTA', habilitada: true});

// Iteración 2 · Auditoría administrativa (D13)
const filtroAuditoria = ref({q: '', entidad: '', dias: '7', desde: '', hasta: ''});

const esAdmin = computed(() => sesion.value?.rol === 'ADMIN');

const salidaActual = computed(
  () => activos.value.find(x => x.placa === salida.value.placa.trim().toUpperCase()) || null
);

const celdasDisponibles = computed(() =>
  celdas.value.filter(c => {
    if (c.estado_ocupacion !== 'DISPONIBLE') return false;
    if (!vehiculoActual.value) return true;
    return (
      c.tipo === 'MIXTA' ||
      (vehiculoActual.value.tipo === 'MOTOCICLETA' ? c.tipo === 'MOTOCICLETA' : c.tipo === 'AUTOMOVIL')
    );
  })
);

const resumenCeldas = computed(() => {
  const lista = celdas.value;
  return {
    habilitadas: lista.filter(c => Number(c.habilitada) === 1).length,
    ocupadas: lista.filter(c => c.estado_ocupacion === 'OCUPADA').length,
    disponibles: lista.filter(c => c.estado_ocupacion === 'DISPONIBLE').length,
    deshabilitadas: lista.filter(c => Number(c.habilitada) === 0).length,
  };
});

const celdasFiltradas = computed(() => {
  return celdas.value.filter(c => {
    if (filtroCeldas.value.tipoExacto && c.tipo !== filtroCeldas.value.tipoExacto) return false;
    if (filtroCeldas.value.estadoOcupacion && c.estado_ocupacion !== filtroCeldas.value.estadoOcupacion) return false;
    if (filtroCeldas.value.habilitada !== '' && String(c.habilitada) !== String(filtroCeldas.value.habilitada)) {
      return false;
    }
    if (filtroCeldas.value.q) {
      const term = filtroCeldas.value.q.trim().toUpperCase();
      const matchCodigo = String(c.codigo || '').toUpperCase().includes(term);
      const matchPlaca = String(c.placa_actual || '').toUpperCase().includes(term);
      if (!matchCodigo && !matchPlaca) return false;
    }
    return true;
  });
});

function alertar(texto, kind = 'success') {
  mensaje.value = {texto, kind};
}

async function trabajo(fn) {
  trabajando.value = true;
  mensaje.value = null;
  try {
    await fn();
  } catch (e) {
    alertar(e.message, 'error');
    if (e.status === 401) {
      sesion.value = null;
      pagina.value = 'panel';
    }
  } finally {
    trabajando.value = false;
  }
}

async function recargar() {
  const promesas = [api('/dashboard'), api('/movimientos?estado=ACTIVO'), api('/celdas')];
  if (sesion.value?.rol === 'ADMIN') {
    promesas.push(api('/auditoria?dias=7'));
  }
  const [p, a, c, aud] = await Promise.all(promesas);
  panel.value = {...panel.value, ...p};
  activos.value = a;
  celdas.value = c;
  if (aud) auditoria.value = aud;
}

async function cargarCuentas() {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filtroCuentas.value).filter(([_, v]) => v !== ''))
  );
  cuentas.value = await api('/usuarios' + (params.size ? '?' + params.toString() : ''));
}

async function cargarClientes() {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filtroClientes.value).filter(([_, v]) => v !== ''))
  );
  clientes.value = await api('/clientes' + (params.size ? '?' + params.toString() : ''));
}

async function buscarAuditoria() {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filtroAuditoria.value).filter(([_, v]) => v !== ''))
  );
  auditoria.value = await api('/auditoria' + (params.size ? '?' + params.toString() : ''));
}

async function cargarPagina(id) {
  pagina.value = id;
  detalle.value = null;
  detalleClienteModal.value = null;
  detalleCeldaModal.value = null;
  await trabajo(async () => {
    if (!sesion.value) return;
    await recargar();
    if (id === 'registroVehiculo') clientes.value = await api('/clientes');
    if (id === 'clientes') {
      vistaClientes.value = 'listado';
      await cargarClientes();
    }
    if (id === 'cuentas' && esAdmin.value) {
      vistaCuentas.value = 'listado';
      await cargarCuentas();
    }
    if (id === 'celdas') {
      vistaCeldas.value = 'mapa';
    }
    if (id === 'historial') await buscarHistorial();
    if (id === 'novedades') novedades.value = await api('/novedades');
    if (id === 'auditoria' && esAdmin.value) await buscarAuditoria();
  });
}

async function ingresar() {
  await trabajo(async () => {
    const data = await api('/auth/login', {method: 'POST', body: login.value});
    sesion.value = data.usuario;
    login.value.contrasena = '';
    pagina.value = 'panel';
    await recargar();
    alertar('Bienvenido al sistema, ' + sesion.value.nombre);
  });
}

async function salirSesion() {
  await trabajo(async () => {
    await api('/auth/logout', {method: 'POST'});
    sesion.value = null;
    pagina.value = 'panel';
  });
}

// ============================================================================
// FUNCIONES ITERACIÓN 1: VEHÍCULOS, ENTRADAS, SALIDAS, HISTORIAL, NOVEDADES
// ============================================================================
async function verificarPlaca() {
  await trabajo(async () => {
    const placa = entrada.value.placa.trim().toUpperCase();
    if (!placa) {
      vehiculoActual.value = null;
      return;
    }
    const rows = await api('/vehiculos?placa=' + encodeURIComponent(placa));
    vehiculoActual.value = rows.find(v => v.placa === placa) || null;
    entrada.value.codigoCelda = '';
    alertar(
      vehiculoActual.value
        ? vehiculoActual.value.vigente
          ? 'Vehículo autorizado. Selecciona una celda.'
          : 'Vehículo no autorizado o mensualidad vencida.'
        : 'La placa no está registrada.',
      vehiculoActual.value?.vigente ? 'success' : 'error'
    );
  });
}

async function guardarVehiculo() {
  await trabajo(async () => {
    vehiculoRegistrado.value = null;
    const data = await api('/vehiculos', {method: 'POST', body: nuevoVehiculo.value});
    vehiculoRegistrado.value = data.vehiculo;
    nuevoVehiculo.value = {
      placa: '',
      tipo: 'AUTOMOVIL',
      color: '',
      clienteId: '',
      autorizado: true,
      autorizacionHasta: '',
    };
    alertar(data.mensaje);
  });
}

async function registrarEntradaDelNuevo() {
  const vehiculo = vehiculoRegistrado.value;
  if (!vehiculo?.vigente) return;
  await cargarPagina('entrada');
  entrada.value = {placa: vehiculo.placa, codigoCelda: ''};
  vehiculoActual.value = vehiculo;
  alertar(`Placa ${vehiculo.placa} conservada. Selecciona una celda disponible.`);
}

async function confirmarEntrada() {
  await trabajo(async () => {
    const data = await api('/movimientos/entrada', {method: 'POST', body: entrada.value});
    alertar(`Entrada MOV-${data.id} registrada correctamente.`);
    entrada.value = {placa: '', codigoCelda: ''};
    vehiculoActual.value = null;
    await recargar();
  });
}

async function confirmarSalida() {
  await trabajo(async () => {
    if (!salidaActual.value) throw new Error('Primero busca una placa con entrada activa.');
    await api(`/movimientos/${salidaActual.value.id}/salida`, {method: 'POST'});
    alertar('Salida registrada. La celda quedó disponible.');
    salida.value.placa = '';
    await recargar();
  });
}

async function buscarHistorial() {
  const params = new URLSearchParams(Object.fromEntries(Object.entries(filtrado.value).filter(([_, v]) => v)));
  historial.value = await api('/movimientos' + (params.size ? '?' + params.toString() : ''));
}

async function guardarNovedad() {
  await trabajo(async () => {
    await api('/novedades', {method: 'POST', body: novedad.value});
    novedad.value = {movimientoId: '', tipo: 'OBSERVACION', descripcion: ''};
    novedades.value = await api('/novedades');
    alertar('Novedad registrada correctamente.');
  });
}

async function verDetalle(id) {
  await trabajo(async () => {
    detalle.value = await api('/movimientos/' + id);
  });
}

// ============================================================================
// FUNCIONES ITERACIÓN 2 · MÓDULO 1: CUENTAS DE ACCESO (RF2-U01 a RF2-U08)
// ============================================================================
function abrirCrearCuenta() {
  nuevaCuenta.value = {nombre: '', usuario: '', rol: 'OPERADOR', contrasena: '', activo: true};
  vistaCuentas.value = 'crear';
  mensaje.value = null;
}

function abrirEditarCuenta(u) {
  cuentaEditando.value = u;
  formEditarCuenta.value = {
    id: u.id,
    nombre: u.nombre,
    usuario: u.usuario,
    rol: u.rol,
    activo: u.activo === 1,
  };
  vistaCuentas.value = 'editar';
  mensaje.value = null;
}

function abrirCredencialesCuenta(u) {
  cuentaEditando.value = u;
  formCredenciales.value = {contrasena: '', confirmacion: ''};
  vistaCuentas.value = 'credenciales';
  mensaje.value = null;
}

async function guardarNuevaCuenta() {
  await trabajo(async () => {
    const data = await api('/usuarios', {method: 'POST', body: nuevaCuenta.value});
    await cargarCuentas();
    await recargar();
    vistaCuentas.value = 'listado';
    alertar(data.mensaje);
  });
}

async function guardarEdicionCuenta() {
  await trabajo(async () => {
    const data = await api(`/usuarios/${formEditarCuenta.value.id}`, {
      method: 'PUT',
      body: {
        nombre: formEditarCuenta.value.nombre,
        rol: formEditarCuenta.value.rol,
        activo: formEditarCuenta.value.activo,
      },
    });
    cuentaEditando.value = data.usuario;
    await cargarCuentas();
    await recargar();
    vistaCuentas.value = 'listado';
    alertar(data.mensaje);
  });
}

async function alternarEstadoCuenta(u) {
  await trabajo(async () => {
    const nuevoEstado = u.activo === 1 ? false : true;
    const data = await api(`/usuarios/${u.id}`, {
      method: 'PATCH',
      body: {activo: nuevoEstado},
    });
    cuentaEditando.value = data.usuario;
    await cargarCuentas();
    await recargar();
    alertar(nuevoEstado ? `Cuenta ${u.usuario} activada.` : `Cuenta ${u.usuario} desactivada.`);
  });
}

async function guardarNuevasCredenciales() {
  await trabajo(async () => {
    if (!cuentaEditando.value) return;
    const data = await api(`/usuarios/${cuentaEditando.value.id}/credenciales`, {
      method: 'PATCH',
      body: formCredenciales.value,
    });
    formCredenciales.value = {contrasena: '', confirmacion: ''};
    await recargar();
    alertar(data.mensaje);
  });
}

// ============================================================================
// FUNCIONES ITERACIÓN 2 · MÓDULO 2: CLIENTES MENSUALISTAS (RF2-CL01 a RF2-CL05)
// ============================================================================
function abrirCrearCliente() {
  nuevoCliente.value = {nombre: '', documento: '', telefono: '', correo: '', activo: true};
  vistaClientes.value = 'crear';
  mensaje.value = null;
}

function abrirEditarCliente(c) {
  clienteEditando.value = c;
  formEditarCliente.value = {
    id: c.id,
    nombre: c.nombre,
    documento: c.documento,
    telefono: c.telefono || '',
    correo: c.correo || '',
    activo: c.activo === 1,
  };
  vistaClientes.value = 'editar';
  mensaje.value = null;
}

async function verFichaCliente(id) {
  await trabajo(async () => {
    detalleClienteModal.value = await api(`/clientes/${id}`);
  });
}

async function guardarNuevoCliente() {
  await trabajo(async () => {
    const data = await api('/clientes', {method: 'POST', body: nuevoCliente.value});
    await cargarClientes();
    await recargar();
    vistaClientes.value = 'listado';
    alertar(data.mensaje);
  });
}

async function guardarEdicionCliente() {
  await trabajo(async () => {
    const data = await api(`/clientes/${formEditarCliente.value.id}`, {
      method: 'PUT',
      body: {
        nombre: formEditarCliente.value.nombre,
        documento: formEditarCliente.value.documento,
        telefono: formEditarCliente.value.telefono,
        correo: formEditarCliente.value.correo,
        activo: formEditarCliente.value.activo,
      },
    });
    clienteEditando.value = data.cliente;
    await cargarClientes();
    await recargar();
    vistaClientes.value = 'listado';
    alertar(data.mensaje);
  });
}

async function alternarEstadoCliente(c) {
  await trabajo(async () => {
    const nuevoEstado = c.activo === 1 ? false : true;
    const data = await api(`/clientes/${c.id}`, {
      method: 'PATCH',
      body: {activo: nuevoEstado},
    });
    clienteEditando.value = data.cliente;
    formEditarCliente.value.activo = data.cliente.activo === 1;
    await cargarClientes();
    await recargar();
    alertar(nuevoEstado ? `Cliente ${c.nombre} activado.` : `Cliente ${c.nombre} desactivado.`);
  });
}

// ============================================================================
// FUNCIONES ITERACIÓN 2 · MÓDULO 3: GESTIÓN DE CELDAS (RF2-C01 a RF2-C09)
// ============================================================================
function abrirCrearCelda() {
  nuevaCelda.value = {codigo: '', tipo: 'MIXTA', habilitada: true};
  vistaCeldas.value = 'crear';
  mensaje.value = null;
}

function seleccionarCelda(c) {
  if (!esAdmin.value) {
    detalleCeldaModal.value = c;
    return;
  }
  celdaEditando.value = c;
  formEditarCelda.value = {
    id: c.id,
    codigo: c.codigo,
    tipo: c.tipo,
    habilitada: Number(c.habilitada) === 1,
  };
  vistaCeldas.value = 'editar';
  mensaje.value = null;
}

function mostrarBloqueoCelda(c) {
  celdaEditando.value = c;
  vistaCeldas.value = 'bloqueo';
  mensaje.value = null;
}

async function guardarNuevaCelda() {
  await trabajo(async () => {
    const data = await api('/celdas', {method: 'POST', body: nuevaCelda.value});
    await recargar();
    vistaCeldas.value = 'mapa';
    alertar(data.mensaje);
  });
}

async function guardarEdicionCelda() {
  await trabajo(async () => {
    if (
      celdaEditando.value?.estado_ocupacion === 'OCUPADA' &&
      !formEditarCelda.value.habilitada
    ) {
      vistaCeldas.value = 'bloqueo';
      throw new Error('No se puede deshabilitar una celda con permanencia activa.');
    }
    const data = await api(`/celdas/${formEditarCelda.value.id}`, {
      method: 'PUT',
      body: {
        codigo: formEditarCelda.value.codigo,
        tipo: formEditarCelda.value.tipo,
        habilitada: formEditarCelda.value.habilitada,
      },
    });
    celdaEditando.value = data.celda;
    await recargar();
    vistaCeldas.value = 'mapa';
    alertar(data.mensaje);
  });
}

async function cambiarHabilitacionRapidaCelda(c) {
  if (c.estado_ocupacion === 'OCUPADA' && Number(c.habilitada) === 1) {
    mostrarBloqueoCelda(c);
    alertar('No se puede deshabilitar una celda con permanencia activa.', 'error');
    return;
  }
  await trabajo(async () => {
    const nuevaHabilitada = Number(c.habilitada) === 1 ? false : true;
    await api(`/celdas/${c.id}`, {
      method: 'PATCH',
      body: {habilitada: nuevaHabilitada},
    });
    await recargar();
    alertar(
      nuevaHabilitada
        ? `Celda ${c.codigo} habilitada para asignaciones.`
        : `Celda ${c.codigo} deshabilitada.`
    );
  });
}

function formatearDetallesAuditoria(detalles) {
  if (!detalles) return '—';
  try {
    const obj = typeof detalles === 'string' ? JSON.parse(detalles) : detalles;
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
  } catch {
    return String(detalles);
  }
}

const fecha = formatearFecha;

const titulosPagina = {
  panel: 'Panel administrativo y operativo',
  registroVehiculo: 'Registrar vehículo',
  entrada: 'Registrar entrada',
  activos: 'Vehículos dentro',
  salida: 'Registrar salida',
  historial: 'Historial de movimientos',
  novedades: 'Novedades operativas',
  cuentas: 'Cuentas de acceso',
  clientes: 'Clientes mensualistas',
  celdas: 'Celdas y disponibilidad',
  auditoria: 'Auditoría administrativa',
};

const subtitulosPagina = {
  panel: 'Resumen integral de cuentas, clientes, disponibilidad de celdas y movimientos en tiempo real.',
  registroVehiculo: 'Registra vehículos asociados a clientes mensualistas activos.',
  entrada: 'Validación de vigencia y asignación de celda compatible.',
  activos: 'Consulta de vehículos estacionados actualmente en el parqueadero.',
  salida: 'Cierre de permanencia activa y liberación automática de celda.',
  historial: 'Trazabilidad histórica de ingresos y salidas.',
  novedades: 'Registro y consulta de incidentes u observaciones sobre permanencias activas.',
  cuentas: 'Gestiona credenciales, roles y estado del personal autorizado.',
  clientes: 'Consulta y administración de titulares del servicio mensual de estacionamiento.',
  celdas: 'Consulta de espacios, mapa de ocupación real y configuración de celdas.',
  auditoria: 'Trazabilidad de las operaciones sobre usuarios, clientes, celdas y movimientos.',
};

const titulo = computed(() => titulosPagina[pagina.value] || 'Panel principal');
const subtitulo = computed(() => subtitulosPagina[pagina.value] || '');

onMounted(async () => {
  try {
    const d = await api('/auth/me');
    sesion.value = d.usuario;
    await recargar();
  } catch {
  } finally {
    cargando.value = false;
  }
});
</script>

<template>
  <div v-if="cargando" class="splash">Iniciando Autos Colombia…</div>

  <!-- LOGIN (Iteración 1 conservado) -->
  <div v-else-if="!sesion" class="login-shell">
    <section class="login-hero">
      <div class="brand">
        <span class="brand-mark">AC</span>
        <span>AUTOS COLOMBIA<small>SISTEMA DE INFORMACIÓN</small></span>
      </div>
      <div class="hero-content">
        <div class="eyebrow">PARQUEADERO · ITERACIONES 1 Y 2</div>
        <h1>Control inteligente<br />del parqueadero.</h1>
        <p>
          Registra movimientos, consulta la ocupación en tiempo real y administra cuentas, clientes mensualistas y
          celdas.
        </p>
        <div class="parking-map">
          <div v-for="i in 10" :key="i" class="parking-space" :class="i % 3 === 0 ? 'filled' : ''">
            {{ String(i).padStart(2, '0') }}
          </div>
        </div>
      </div>
      <span class="hero-foot">Autos Colombia · Operación y Administración</span>
    </section>
    <section class="login-panel">
      <form class="login-card" @submit.prevent="ingresar">
        <div class="eyebrow teal">ACCESO AUTORIZADO</div>
        <h2>Bienvenido de nuevo</h2>
        <p class="muted">Accede con tu cuenta de administrador u operador.</p>
        <label>
          Usuario
          <input v-model.trim="login.usuario" autocomplete="username" required placeholder="Ingresa tu usuario" />
        </label>
        <label>
          Contraseña
          <input
            v-model="login.contrasena"
            type="password"
            autocomplete="current-password"
            required
            placeholder="••••••••"
          />
        </label>
        <p v-if="mensaje?.kind === 'error'" class="alert error" role="alert">{{ mensaje.texto }}</p>
        <button class="btn primary fill" :disabled="trabajando">
          {{ trabajando ? 'Validando…' : 'Iniciar sesión' }}
        </button>
        <small class="muted centered">Acceso exclusivo para personal autorizado.</small>
      </form>
      <small class="login-note">Versión académica · Conexión real a MySQL</small>
    </section>
  </div>

  <!-- APLICACIÓN AUTENTICADA -->
  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand small">
        <span class="brand-mark">AC</span>
        <span>
          AUTOS COLOMBIA
          <small>{{ esAdmin ? 'ADMINISTRACIÓN' : 'OPERACIÓN' }}</small>
        </span>
      </div>

      <span class="side-title">OPERACIÓN VEHICULAR</span>
      <nav aria-label="Menú operativo">
        <button
          v-for="item in navOperacion"
          :key="item.id"
          :class="['nav-item', {selected: pagina === item.id}]"
          @click="cargarPagina(item.id)"
        >
          <span>{{ item.icon }}</span>{{ item.label }}
        </button>
      </nav>

      <span class="side-title side-section">GESTIÓN Y CONSULTA · I2</span>
      <nav aria-label="Menú administrativo">
        <button
          v-if="esAdmin"
          :class="['nav-item', {selected: pagina === 'cuentas'}]"
          @click="cargarPagina('cuentas')"
        >
          <span>U</span>Cuentas de acceso
        </button>
        <button :class="['nav-item', {selected: pagina === 'clientes'}]" @click="cargarPagina('clientes')">
          <span>C</span>Clientes mensualistas
        </button>
        <button :class="['nav-item', {selected: pagina === 'celdas'}]" @click="cargarPagina('celdas')">
          <span>P</span>Gestión de celdas
        </button>
        <button
          v-if="esAdmin"
          :class="['nav-item', {selected: pagina === 'auditoria'}]"
          @click="cargarPagina('auditoria')"
        >
          <span>A</span>Auditoría
        </button>
      </nav>

      <div class="side-bottom">
        <div class="badge-lite">Sistema activo · Rol {{ sesion.rol }}</div>
        <button class="nav-item" @click="salirSesion"><span>⇥</span> Cerrar sesión</button>
        <div class="operator">
          <span class="avatar">{{ sesion.nombre.charAt(0).toUpperCase() }}</span>
          <div>
            <strong>{{ sesion.nombre }}</strong>
            <small>Rol: {{ sesion.rol.toLowerCase() }}</small>
          </div>
        </div>
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <span>Autos Colombia / Iteraciones 1 y 2</span>
        <div>
          <span class="top-pill">{{ esAdmin ? 'Modo Administrador' : 'Modo Operador' }}</span>
          <span class="avatar tiny">{{ sesion.nombre.charAt(0).toUpperCase() }}</span>
        </div>
      </header>

      <div class="content">
        <div class="page-header">
          <div>
            <p class="eyebrow teal">
              {{
                ['cuentas', 'clientes', 'celdas', 'auditoria'].includes(pagina)
                  ? 'GESTIÓN ADMINISTRATIVA · ITERACIÓN 2'
                  : 'CONTROL DE ACCESO VEHICULAR'
              }}
            </p>
            <h1>{{ titulo }}</h1>
            <p class="muted">{{ subtitulo }}</p>
          </div>
          <div class="button-row">
            <button
              v-if="pagina === 'panel' || pagina === 'activos'"
              class="btn primary"
              @click="cargarPagina('entrada')"
            >
              + Registrar entrada
            </button>
            <button
              v-if="pagina === 'cuentas' && esAdmin && vistaCuentas === 'listado'"
              class="btn primary"
              @click="abrirCrearCuenta"
            >
              + Nueva cuenta
            </button>
            <button
              v-if="pagina === 'clientes' && esAdmin && vistaClientes === 'listado'"
              class="btn primary"
              @click="abrirCrearCliente"
            >
              + Nuevo cliente
            </button>
            <span v-if="pagina === 'clientes' && !esAdmin" class="top-pill">Solo consulta</span>
            <button
              v-if="pagina === 'celdas' && esAdmin && vistaCeldas === 'mapa'"
              class="btn primary"
              @click="abrirCrearCelda"
            >
              + Nueva celda
            </button>
            <span v-if="pagina === 'celdas' && !esAdmin" class="top-pill">Solo consulta</span>
          </div>
        </div>

        <p v-if="mensaje" :class="['alert', mensaje.kind]" role="status">
          <span>{{ mensaje.kind === 'success' ? '✓' : '!' }}</span>
          {{ mensaje.texto }}
          <button @click="mensaje = null" aria-label="Cerrar mensaje">×</button>
        </p>

        <!-- ================================================================== -->
        <!-- VISTA 1: PANEL PRINCIPAL / ADMINISTRATIVO (I1 + D01)               -->
        <!-- ================================================================== -->
        <template v-if="pagina === 'panel'">
          <div class="stat-grid">
            <article class="stat-card">
              <span class="stat-caption">Celdas habilitadas</span>
              <strong>{{ panel.total }}</strong>
              <small>{{ panel.disponibles }} disponibles · {{ panel.inhabilitadas || 0 }} inhabilitadas</small>
            </article>
            <article class="stat-card orange">
              <span class="stat-caption">Ocupadas</span>
              <strong>{{ panel.ocupadas }}</strong>
              <small>{{ panel.total ? Math.round((panel.ocupadas / panel.total) * 100) : 0 }} % ocupación</small>
            </article>
            <article class="stat-card green">
              <span class="stat-caption">Disponibles</span>
              <strong>{{ panel.disponibles }}</strong>
              <small>Listas para asignar</small>
            </article>
            <article class="stat-card">
              <span class="stat-caption">Entradas hoy</span>
              <strong>{{ panel.entradas_hoy }}</strong>
              <small>Horario de Colombia</small>
            </article>
          </div>

          <div class="stat-grid">
            <article class="stat-card">
              <span class="stat-caption">Cuentas activas</span>
              <strong>{{ String(panel.cuentas_activas ?? 0).padStart(2, '0') }}</strong>
              <small>{{ panel.admins_activos ?? 0 }} administradores y {{ panel.operadores_activos ?? 0 }} operadores</small>
            </article>
            <article class="stat-card">
              <span class="stat-caption">Clientes registrados</span>
              <strong>{{ String(panel.clientes_total ?? 0).padStart(2, '0') }}</strong>
              <small>{{ panel.clientes_activos ?? 0 }} activos, {{ panel.clientes_inactivos ?? 0 }} inactivos</small>
            </article>
            <article class="stat-card green">
              <span class="stat-caption">Total espacios</span>
              <strong>{{ String(panel.total_celdas ?? panel.total ?? 0).padStart(2, '0') }}</strong>
              <small>{{ panel.disponibles }} disponibles, {{ panel.ocupadas }} ocupadas</small>
            </article>
            <article class="stat-card orange">
              <span class="stat-caption">Cambios recientes</span>
              <strong>{{ String(panel.eventos_hoy ?? 0).padStart(2, '0') }}</strong>
              <small>Eventos de auditoría del día</small>
            </article>
          </div>

          <div class="split wide">
            <div>
              <section class="card">
                <div class="card-head">
                  <div>
                    <h3>Vehículos dentro</h3>
                    <p class="muted">Últimos ingresos activos</p>
                  </div>
                  <button class="linkish" @click="cargarPagina('activos')">Ver todos →</button>
                </div>
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>PLACA</th>
                        <th>CELDA</th>
                        <th>INGRESO</th>
                        <th>ESTADO</th>
                        <th>ACCIÓN</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="m in activos.slice(0, 6)" :key="m.id">
                        <td><strong>{{ m.placa }}</strong></td>
                        <td>{{ m.celda }}</td>
                        <td>{{ fecha(m.fecha_entrada_utc, false) }}</td>
                        <td><span class="status">Activo</span></td>
                        <td><button class="linkish" @click="verDetalle(m.id)">Ver detalle</button></td>
                      </tr>
                      <tr v-if="!activos.length">
                        <td colspan="5" class="empty">No hay vehículos dentro del parqueadero.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section v-if="esAdmin" class="card card-spaced">
                <div class="card-head">
                  <div>
                    <h3>Actividad administrativa</h3>
                    <p class="muted">Últimos eventos registrados en auditoría</p>
                  </div>
                  <button class="linkish" @click="cargarPagina('auditoria')">Ver auditoría →</button>
                </div>
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>FECHA</th>
                        <th>USUARIO</th>
                        <th>CAMBIO</th>
                        <th>ENTIDAD</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="a in auditoria.slice(0, 5)" :key="a.id">
                        <td>{{ fecha(a.fecha_utc) }}</td>
                        <td>{{ a.operador }}</td>
                        <td><strong>{{ a.accion }}</strong></td>
                        <td>{{ a.entidad }} #{{ a.registro_id }}</td>
                      </tr>
                      <tr v-if="!auditoria.length">
                        <td colspan="4" class="empty">Sin eventos recientes.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section class="card quick">
              <h3>Accesos rápidos</h3>
              <button @click="cargarPagina('entrada')">
                ↗ Registrar entrada
                <small>Asignar celda disponible</small>
              </button>
              <button @click="cargarPagina('salida')">
                ↘ Registrar salida
                <small>Cerrar permanencia activa</small>
              </button>
              <button v-if="esAdmin" @click="cargarPagina('cuentas')">
                U Administrar cuentas
                <small>Roles, estados y contraseñas</small>
              </button>
              <button @click="cargarPagina('clientes')">
                C Gestionar clientes
                <small>{{ esAdmin ? 'Datos y habilitación mensualista' : 'Consultar directorio mensualista' }}</small>
              </button>
              <button @click="cargarPagina('celdas')">
                P Ver disponibilidad
                <small>Mapa de ocupación y compatibilidad</small>
              </button>
              <button @click="cargarPagina('historial')">
                ◷ Consultar historial
                <small>Movimientos anteriores</small>
              </button>
            </section>
          </div>
        </template>

        <!-- ================================================================== -->
        <!-- MÓDULO 1 (I2): GESTIÓN DE CUENTAS DE ACCESO (D02, D03, D04, D05)   -->
        <!-- ================================================================== -->
        <template v-else-if="pagina === 'cuentas'">
          <!-- D02: Listado de cuentas -->
          <section v-if="vistaCuentas === 'listado'" class="card">
            <div class="card-head">
              <div>
                <h3>Personal registrado</h3>
                <p class="muted">La creación y modificación requieren rol ADMIN.</p>
              </div>
            </div>

            <form class="filter-grid cols-4" @submit.prevent="trabajo(cargarCuentas)">
              <label>
                Buscar usuario
                <input
                  v-model.trim="filtroCuentas.q"
                  placeholder="Nombre o identificador de acceso"
                />
              </label>
              <label>
                Filtrar por rol
                <select v-model="filtroCuentas.rol">
                  <option value="">Todos</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="OPERADOR">OPERADOR</option>
                </select>
              </label>
              <label>
                Estado de cuenta
                <select v-model="filtroCuentas.activo">
                  <option value="">Todos los estados</option>
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </label>
              <div class="button-row">
                <button class="btn primary" type="submit">Filtrar</button>
                <button
                  class="btn secondary"
                  type="button"
                  @click="
                    filtroCuentas = {q: '', rol: '', activo: ''};
                    trabajo(cargarCuentas);
                  "
                >
                  Limpiar
                </button>
              </div>
            </form>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>NOMBRE</th>
                    <th>USUARIO</th>
                    <th>ROL</th>
                    <th>ESTADO</th>
                    <th>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in cuentas" :key="u.id">
                    <td><strong>{{ u.nombre }}</strong></td>
                    <td>{{ u.usuario }}</td>
                    <td>
                      <span :class="['pill-role', u.rol === 'ADMIN' ? 'admin' : 'operador']">
                        {{ u.rol }}
                      </span>
                    </td>
                    <td>
                      <span :class="['status', u.activo === 1 ? '' : 'inactive']">
                        {{ u.activo === 1 ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>
                    <td>
                      <button class="linkish" @click="abrirEditarCuenta(u)">Editar</button>
                      ·
                      <button class="linkish" @click="abrirCredencialesCuenta(u)">Estado / Clave</button>
                    </td>
                  </tr>
                  <tr v-if="!cuentas.length">
                    <td colspan="5" class="empty">No se encontraron cuentas con los criterios seleccionados.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- D03: Crear cuenta de acceso -->
          <div v-else-if="vistaCuentas === 'crear'" class="split wide">
            <section class="card">
              <h3>Datos de la nueva cuenta</h3>
              <p class="muted">Alta de usuario interno del parqueadero.</p>
              <form class="form-grid" @submit.prevent="guardarNuevaCuenta">
                <div class="two-cols">
                  <label>
                    Nombre completo *
                    <input
                      v-model.trim="nuevaCuenta.nombre"
                      required
                      minlength="3"
                      maxlength="120"
                      placeholder="Ej. Mariana Rodríguez"
                    />
                  </label>
                  <label>
                    Usuario de acceso *
                    <input
                      v-model.trim="nuevaCuenta.usuario"
                      required
                      minlength="3"
                      maxlength="60"
                      placeholder="Ej. mrodriguez"
                      autocomplete="off"
                    />
                  </label>
                </div>
                <div class="two-cols">
                  <label>
                    Rol asignado *
                    <select v-model="nuevaCuenta.rol" required>
                      <option value="OPERADOR">OPERADOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </label>
                  <label>
                    Contraseña inicial *
                    <input
                      v-model="nuevaCuenta.contrasena"
                      type="password"
                      required
                      minlength="8"
                      maxlength="120"
                      placeholder="Mínimo 8 caracteres"
                      autocomplete="new-password"
                    />
                  </label>
                </div>
                <label class="checkbox-row">
                  <input v-model="nuevaCuenta.activo" type="checkbox" />
                  <span>Cuenta habilitada para iniciar sesión</span>
                </label>
                <div class="info-inline">
                  El usuario de acceso debe ser único. La contraseña se almacenará cifrada con bcrypt.
                </div>
                <div class="button-row">
                  <button class="btn primary" :disabled="trabajando">
                    {{ trabajando ? 'Guardando…' : 'Guardar cuenta' }}
                  </button>
                  <button type="button" class="btn secondary" @click="vistaCuentas = 'listado'">Cancelar</button>
                </div>
              </form>
            </section>
            <section class="card narrow">
              <h3>Políticas de seguridad</h3>
              <p>✓ Solo ADMIN puede crear cuentas o asignar roles.</p>
              <p>✓ Las claves nunca se muestran después de guardarse.</p>
              <p>✓ El identificador de acceso no admite duplicados.</p>
              <p>✓ Se registrará la acción en auditoría.</p>
            </section>
          </div>

          <!-- D04: Editar cuenta y rol -->
          <div v-else-if="vistaCuentas === 'editar'" class="split wide">
            <section class="card">
              <h3>Editar cuenta · {{ formEditarCuenta.nombre }}</h3>
              <p class="muted">Modifica datos y roles sin alterar el identificador interno.</p>
              <form class="form-grid" @submit.prevent="guardarEdicionCuenta">
                <div class="two-cols">
                  <label>
                    Nombre completo *
                    <input v-model.trim="formEditarCuenta.nombre" required minlength="3" maxlength="120" />
                  </label>
                  <label>
                    Usuario de acceso *
                    <input :value="formEditarCuenta.usuario" disabled class="readonly-input" />
                  </label>
                </div>
                <div class="two-cols">
                  <label>
                    Rol autorizado
                    <select v-model="formEditarCuenta.rol">
                      <option value="OPERADOR">OPERADOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </label>
                  <label>
                    Estado actual
                    <select v-model="formEditarCuenta.activo">
                      <option :value="true">Activo</option>
                      <option :value="false">Inactivo</option>
                    </select>
                  </label>
                </div>
                <div class="info-inline">
                  Los cambios de rol y estado se registrarán con el administrador responsable en auditoría.
                </div>
                <div class="button-row">
                  <button class="btn primary" :disabled="trabajando">
                    {{ trabajando ? 'Guardando…' : 'Guardar cambios' }}
                  </button>
                  <button
                    type="button"
                    class="btn secondary"
                    @click="abrirCredencialesCuenta(cuentaEditando)"
                  >
                    Estado y credenciales
                  </button>
                  <button type="button" class="btn secondary" @click="vistaCuentas = 'listado'">
                    Volver al listado
                  </button>
                </div>
              </form>
            </section>
            <section class="card narrow">
              <h3>Permisos por rol</h3>
              <span class="pill-role admin">ADMIN</span>
              <p>Gestiona usuarios y clientes mensualistas. Administra las celdas y consulta auditoría.</p>
              <hr />
              <span class="pill-role operador">OPERADOR</span>
              <p>Registra entradas, salidas y novedades. Consulta clientes y disponibilidad de celdas.</p>
            </section>
          </div>

          <!-- D05: Estado y credenciales -->
          <div v-else-if="vistaCuentas === 'credenciales' && cuentaEditando" class="two-cards">
            <section class="card">
              <h3>Estado de la cuenta</h3>
              <p><strong>Usuario: {{ cuentaEditando.usuario }}</strong> ({{ cuentaEditando.nombre }})</p>
              <p>
                <span :class="['status', cuentaEditando.activo === 1 ? '' : 'inactive']">
                  {{ cuentaEditando.activo === 1 ? 'Activo' : 'Inactivo' }}
                </span>
              </p>
              <p class="muted">
                El acceso permanecerá restringido mientras la cuenta esté inactiva. Si una cuenta se desactiva, cualquier
                sesión abierta pierde autorización de inmediato.
              </p>
              <div class="info-inline warn">
                No se puede desactivar ni degradar al último ADMIN activo.
              </div>
              <div class="button-row" style="margin-top: 20px">
                <button
                  class="btn primary"
                  :disabled="trabajando"
                  @click="alternarEstadoCuenta(cuentaEditando)"
                >
                  {{ cuentaEditando.activo === 1 ? 'Desactivar cuenta' : 'Activar cuenta' }}
                </button>
                <button type="button" class="btn secondary" @click="vistaCuentas = 'listado'">
                  Volver al listado
                </button>
              </div>
            </section>

            <section class="card">
              <h3>Restablecer credenciales</h3>
              <p class="muted">Asigna una nueva contraseña segura para {{ cuentaEditando.usuario }}.</p>
              <form class="form-grid" @submit.prevent="guardarNuevasCredenciales">
                <label>
                  Nueva contraseña *
                  <input
                    v-model="formCredenciales.contrasena"
                    type="password"
                    required
                    minlength="8"
                    maxlength="120"
                    placeholder="••••••••••••"
                    autocomplete="new-password"
                  />
                </label>
                <label>
                  Confirmar contraseña *
                  <input
                    v-model="formCredenciales.confirmacion"
                    type="password"
                    required
                    minlength="8"
                    maxlength="120"
                    placeholder="••••••••••••"
                    autocomplete="new-password"
                  />
                </label>
                <div class="info-inline">
                  La contraseña anterior nunca se recupera ni se muestra.
                </div>
                <div class="button-row">
                  <button class="btn primary" :disabled="trabajando">
                    {{ trabajando ? 'Guardando…' : 'Guardar nueva contraseña' }}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </template>

        <!-- ================================================================== -->
        <!-- MÓDULO 2 (I2): GESTIÓN DE CLIENTES MENSUALISTAS (D06, D07, D08)    -->
        <!-- ================================================================== -->
        <template v-else-if="pagina === 'clientes'">
          <!-- D06: Listado de clientes -->
          <section v-if="vistaClientes === 'listado'" class="card">
            <div class="card-head">
              <div>
                <h3>Directorio de clientes</h3>
                <p class="muted">Los clientes inactivos conservan sus vehículos y movimientos históricos.</p>
              </div>
            </div>

            <form class="filter-grid cols-3" @submit.prevent="trabajo(cargarClientes)">
              <label>
                Buscar cliente
                <input
                  v-model.trim="filtroClientes.q"
                  placeholder="Nombre o número de documento"
                />
              </label>
              <label>
                Estado
                <select v-model="filtroClientes.activo">
                  <option value="">Todos</option>
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </label>
              <div class="button-row">
                <button class="btn primary" type="submit">Buscar</button>
                <button
                  class="btn secondary"
                  type="button"
                  @click="
                    filtroClientes = {q: '', activo: ''};
                    trabajo(cargarClientes);
                  "
                >
                  Limpiar
                </button>
              </div>
            </form>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>NOMBRE</th>
                    <th>DOCUMENTO</th>
                    <th>CONTACTO</th>
                    <th>VEHÍCULOS</th>
                    <th>ESTADO</th>
                    <th>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in clientes" :key="c.id">
                    <td><strong>{{ c.nombre }}</strong></td>
                    <td>{{ c.documento }}</td>
                    <td>{{ c.correo || c.telefono || '—' }}</td>
                    <td>{{ c.total_vehiculos ?? 0 }}</td>
                    <td>
                      <span :class="['status', c.activo === 1 ? '' : 'inactive']">
                        {{ c.activo === 1 ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>
                    <td>
                      <button class="linkish" @click="verFichaCliente(c.id)">Ver</button>
                      <template v-if="esAdmin">
                        ·
                        <button class="linkish" @click="abrirEditarCliente(c)">Editar</button>
                      </template>
                    </td>
                  </tr>
                  <tr v-if="!clientes.length">
                    <td colspan="6" class="empty">No se encontraron clientes con estos criterios.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="!esAdmin" class="info-inline" style="margin-top: 16px">
              Vista de solo consulta para OPERADOR. Solo ADMIN puede registrar o modificar clientes.
            </div>
          </section>

          <!-- D07: Registrar cliente -->
          <div v-else-if="vistaClientes === 'crear' && esAdmin" class="split wide">
            <section class="card">
              <h3>Datos del cliente</h3>
              <p class="muted">Alta de titular del servicio mensual de estacionamiento.</p>
              <form class="form-grid" @submit.prevent="guardarNuevoCliente">
                <div class="two-cols">
                  <label>
                    Nombre completo *
                    <input
                      v-model.trim="nuevoCliente.nombre"
                      required
                      minlength="3"
                      maxlength="120"
                      placeholder="Ej. Valentina Osorio"
                    />
                  </label>
                  <label>
                    Documento de identidad *
                    <input
                      v-model.trim="nuevoCliente.documento"
                      required
                      minlength="4"
                      maxlength="25"
                      placeholder="Ej. 1015346289"
                    />
                  </label>
                </div>
                <div class="two-cols">
                  <label>
                    Teléfono
                    <input
                      v-model.trim="nuevoCliente.telefono"
                      maxlength="25"
                      placeholder="Ej. 300 452 9081"
                    />
                  </label>
                  <label>
                    Correo electrónico
                    <input
                      v-model.trim="nuevoCliente.correo"
                      type="email"
                      maxlength="120"
                      placeholder="valentina@ejemplo.com"
                    />
                  </label>
                </div>
                <label class="checkbox-row">
                  <input v-model="nuevoCliente.activo" type="checkbox" />
                  <span>Cliente activo</span>
                </label>
                <div class="button-row">
                  <button class="btn primary" :disabled="trabajando">
                    {{ trabajando ? 'Guardando…' : 'Registrar cliente' }}
                  </button>
                  <button type="button" class="btn secondary" @click="vistaClientes = 'listado'">Cancelar</button>
                </div>
              </form>
            </section>
            <section class="card narrow">
              <h3>Validaciones previas</h3>
              <p>✓ Nombre y documento son obligatorios.</p>
              <p>✓ El documento debe ser único.</p>
              <p>✓ Teléfono y correo son opcionales.</p>
              <p>✓ Acción auditada automáticamente.</p>
            </section>
          </div>

          <!-- D08: Editar cliente y validación -->
          <div v-else-if="vistaClientes === 'editar' && esAdmin && clienteEditando" class="split wide">
            <section class="card">
              <h3>Editar cliente · {{ clienteEditando.nombre }}</h3>
              <p class="muted">Los cambios conservan vehículos y registros anteriores.</p>
              <form class="form-grid" @submit.prevent="guardarEdicionCliente">
                <div class="two-cols">
                  <label>
                    Nombre completo *
                    <input v-model.trim="formEditarCliente.nombre" required minlength="3" maxlength="120" />
                  </label>
                  <label>
                    Documento de identidad *
                    <input v-model.trim="formEditarCliente.documento" required minlength="4" maxlength="25" />
                  </label>
                </div>
                <div class="two-cols">
                  <label>
                    Teléfono
                    <input v-model.trim="formEditarCliente.telefono" maxlength="25" placeholder="Ej. 314 567 8820" />
                  </label>
                  <label>
                    Correo electrónico
                    <input
                      v-model.trim="formEditarCliente.correo"
                      type="email"
                      maxlength="120"
                      placeholder="cliente@ejemplo.com"
                    />
                  </label>
                </div>
                <div class="button-row">
                  <button class="btn primary" :disabled="trabajando">
                    {{ trabajando ? 'Guardando…' : 'Guardar cambios' }}
                  </button>
                  <button type="button" class="btn secondary" @click="vistaClientes = 'listado'">Cancelar</button>
                </div>
              </form>
            </section>
            <section class="card narrow">
              <h3>Estado del cliente</h3>
              <p>
                <span :class="['status', formEditarCliente.activo ? '' : 'inactive']">
                  {{ formEditarCliente.activo ? 'Activo' : 'Inactivo' }}
                </span>
              </p>
              <p>Desactivar no elimina al cliente ni sus vehículos asociados.</p>
              <p>El acceso de vehículos se verifica por vigencia y autorización.</p>
              <div class="button-row" style="margin-top: 18px">
                <button
                  type="button"
                  class="btn warn-btn"
                  :disabled="trabajando"
                  @click="alternarEstadoCliente(clienteEditando)"
                >
                  {{ formEditarCliente.activo ? 'Desactivar cliente' : 'Activar cliente' }}
                </button>
              </div>
            </section>
          </div>
        </template>

        <!-- ================================================================== -->
        <!-- MÓDULO 3 (I2): GESTIÓN DE CELDAS (D09, D10, D11, D12, D14)         -->
        <!-- ================================================================== -->
        <template v-else-if="pagina === 'celdas'">
          <div class="stat-grid">
            <article class="stat-card">
              <span class="stat-caption">Habilitadas</span>
              <strong>{{ String(resumenCeldas.habilitadas).padStart(2, '0') }}</strong>
              <small>Capacidad activa</small>
            </article>
            <article class="stat-card orange">
              <span class="stat-caption">Ocupadas</span>
              <strong>{{ String(resumenCeldas.ocupadas).padStart(2, '0') }}</strong>
              <small>Con permanencia activa</small>
            </article>
            <article class="stat-card green">
              <span class="stat-caption">Disponibles</span>
              <strong>{{ String(resumenCeldas.disponibles).padStart(2, '0') }}</strong>
              <small>Libres para asignar</small>
            </article>
            <article class="stat-card red">
              <span class="stat-caption">Deshabilitadas</span>
              <strong>{{ String(resumenCeldas.deshabilitadas).padStart(2, '0') }}</strong>
              <small>Fuera de servicio</small>
            </article>
          </div>

          <!-- D09 + D14: Mapa y tabla de disponibilidad -->
          <template v-if="vistaCeldas === 'mapa'">
            <section class="card">
              <div class="card-head">
                <div>
                  <h3>Mapa de celdas</h3>
                  <p class="muted">
                    {{
                      esAdmin
                        ? 'Selecciona una celda para editar su configuración o estado.'
                        : 'Vista de solo lectura · Disponibilidad en tiempo real.'
                    }}
                  </p>
                </div>
                <div class="pill-bar">
                  <span class="muted">Tipo:</span>
                  <button
                    type="button"
                    :class="['pill-filter', {active: filtroCeldas.tipoExacto === ''}]"
                    @click="filtroCeldas.tipoExacto = ''"
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    :class="['pill-filter', {active: filtroCeldas.tipoExacto === 'AUTOMOVIL'}]"
                    @click="filtroCeldas.tipoExacto = 'AUTOMOVIL'"
                  >
                    Automóvil
                  </button>
                  <button
                    type="button"
                    :class="['pill-filter', {active: filtroCeldas.tipoExacto === 'MOTOCICLETA'}]"
                    @click="filtroCeldas.tipoExacto = 'MOTOCICLETA'"
                  >
                    Moto
                  </button>
                  <button
                    type="button"
                    :class="['pill-filter', {active: filtroCeldas.tipoExacto === 'MIXTA'}]"
                    @click="filtroCeldas.tipoExacto = 'MIXTA'"
                  >
                    Mixta
                  </button>
                </div>
              </div>

              <div class="filter-grid cols-3" style="margin-bottom: 20px">
                <label>
                  Buscar celda o placa
                  <input v-model.trim="filtroCeldas.q" placeholder="Ej. C-001 o ABC123" />
                </label>
                <label>
                  Estado de ocupación
                  <select v-model="filtroCeldas.estadoOcupacion">
                    <option value="">Todos</option>
                    <option value="DISPONIBLE">Disponible</option>
                    <option value="OCUPADA">Ocupada</option>
                    <option value="INHABILITADA">Inhabilitada</option>
                  </select>
                </label>
                <label>
                  Habilitación
                  <select v-model="filtroCeldas.habilitada">
                    <option value="">Todas</option>
                    <option value="1">Habilitadas</option>
                    <option value="0">Deshabilitadas</option>
                  </select>
                </label>
              </div>

              <div class="cell-map-grid">
                <button
                  v-for="c in celdasFiltradas"
                  :key="c.id"
                  type="button"
                  :class="[
                    'cell-tile',
                    c.estado_ocupacion === 'OCUPADA'
                      ? 'occupied'
                      : c.estado_ocupacion === 'INHABILITADA'
                        ? 'disabled'
                        : 'available',
                  ]"
                  @click="seleccionarCelda(c)"
                >
                  <strong>{{ c.codigo }}</strong>
                  <small>{{ c.tipo }}</small>
                  <span>
                    {{
                      c.estado_ocupacion === 'OCUPADA'
                        ? `Ocupada · ${c.placa_actual || ''}`
                        : c.estado_ocupacion === 'INHABILITADA'
                          ? 'Inhabilitada'
                          : 'Disponible'
                    }}
                  </span>
                </button>
              </div>
            </section>

            <!-- Tabla de celdas (D14 / D09) -->
            <section class="card card-spaced">
              <div class="card-head">
                <div>
                  <h3>Disponibilidad del parqueadero</h3>
                  <p class="muted">{{ celdasFiltradas.length }} celdas listadas</p>
                </div>
                <span v-if="!esAdmin" class="top-pill">Solo consulta</span>
              </div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>CELDA</th>
                      <th>TIPO</th>
                      <th>HABILITACIÓN</th>
                      <th>OCUPACIÓN</th>
                      <th>VEHÍCULO ACTUAL</th>
                      <th>ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in celdasFiltradas" :key="c.id">
                      <td><strong>{{ c.codigo }}</strong></td>
                      <td>{{ c.tipo }}</td>
                      <td>
                        <span :class="['status', Number(c.habilitada) === 1 ? '' : 'inactive']">
                          {{ Number(c.habilitada) === 1 ? 'Habilitada' : 'Deshabilitada' }}
                        </span>
                      </td>
                      <td>
                        <span
                          :class="[
                            'status',
                            c.estado_ocupacion === 'OCUPADA'
                              ? 'occupied-pill'
                              : c.estado_ocupacion === 'INHABILITADA'
                                ? 'ended'
                                : '',
                          ]"
                        >
                          {{
                            c.estado_ocupacion === 'OCUPADA'
                              ? 'Ocupada'
                              : c.estado_ocupacion === 'INHABILITADA'
                                ? 'Sin asignar'
                                : 'Disponible'
                          }}
                        </span>
                      </td>
                      <td>{{ c.placa_actual || '—' }}</td>
                      <td>
                        <template v-if="esAdmin">
                          <button class="linkish" @click="seleccionarCelda(c)">Editar</button>
                          ·
                          <button class="linkish" @click="cambiarHabilitacionRapidaCelda(c)">
                            {{ Number(c.habilitada) === 1 ? 'Deshabilitar' : 'Habilitar' }}
                          </button>
                        </template>
                        <button v-else class="linkish" @click="seleccionarCelda(c)">Ver</button>
                      </td>
                    </tr>
                    <tr v-if="!celdasFiltradas.length">
                      <td colspan="6" class="empty">No hay celdas que coincidan con el filtro seleccionado.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="!esAdmin" class="info-inline" style="margin-top: 16px">
                Solo ADMIN puede crear, editar, cambiar tipos o deshabilitar celdas.
              </div>
            </section>
          </template>

          <!-- D10: Crear celda -->
          <div v-else-if="vistaCeldas === 'crear' && esAdmin" class="split wide">
            <section class="card">
              <h3>Nueva celda de estacionamiento</h3>
              <p class="muted">Define el espacio sin permitir códigos duplicados.</p>
              <form class="form-grid" @submit.prevent="guardarNuevaCelda">
                <div class="two-cols">
                  <label>
                    Código de celda *
                    <input
                      v-model.trim="nuevaCelda.codigo"
                      required
                      maxlength="16"
                      placeholder="Ej. C-031"
                    />
                  </label>
                  <label>
                    Tipo de celda *
                    <select v-model="nuevaCelda.tipo" required>
                      <option value="MIXTA">MIXTA</option>
                      <option value="AUTOMOVIL">AUTOMOVIL</option>
                      <option value="MOTOCICLETA">MOTOCICLETA</option>
                    </select>
                  </label>
                </div>
                <label class="checkbox-row">
                  <input v-model="nuevaCelda.habilitada" type="checkbox" />
                  <span>Habilitada para asignaciones</span>
                </label>
                <div class="info-inline">
                  El código debe ser único, incluso entre celdas deshabilitadas.
                </div>
                <div class="button-row">
                  <button class="btn primary" :disabled="trabajando">
                    {{ trabajando ? 'Guardando…' : 'Guardar celda' }}
                  </button>
                  <button type="button" class="btn secondary" @click="vistaCeldas = 'mapa'">Cancelar</button>
                </div>
              </form>
            </section>
            <section class="card narrow">
              <h3>Tipos permitidos</h3>
              <p><strong>AUTOMOVIL</strong><br />Vehículos tipo automóvil y camioneta.</p>
              <p><strong>MOTOCICLETA</strong><br />Vehículos tipo motocicleta.</p>
              <p><strong>MIXTA</strong><br />Admite ambas categorías.</p>
            </section>
          </div>

          <!-- D11: Editar celda y habilitación -->
          <div v-else-if="vistaCeldas === 'editar' && esAdmin && celdaEditando" class="split wide">
            <section class="card">
              <h3>Configuración de celda {{ celdaEditando.codigo }}</h3>
              <p class="muted">Modifica únicamente los atributos que admite su ocupación.</p>
              <form class="form-grid" @submit.prevent="guardarEdicionCelda">
                <div class="two-cols">
                  <label>
                    Código *
                    <input
                      v-model.trim="formEditarCelda.codigo"
                      required
                      maxlength="16"
                      :disabled="celdaEditando.estado_ocupacion === 'OCUPADA'"
                    />
                  </label>
                  <label>
                    Tipo de celda
                    <select v-model="formEditarCelda.tipo">
                      <option value="MIXTA">MIXTA</option>
                      <option value="AUTOMOVIL">AUTOMOVIL</option>
                      <option value="MOTOCICLETA">MOTOCICLETA</option>
                    </select>
                  </label>
                </div>
                <label class="checkbox-row">
                  <input v-model="formEditarCelda.habilitada" type="checkbox" />
                  <span>Habilitada para nuevas asignaciones</span>
                </label>
                <div class="info-inline warn">
                  Antes de actualizar, el sistema verificará si existe una entrada activa.
                </div>
                <div class="button-row">
                  <button class="btn primary" :disabled="trabajando">
                    {{ trabajando ? 'Guardando…' : 'Guardar cambios' }}
                  </button>
                  <button type="button" class="btn secondary" @click="vistaCeldas = 'mapa'">Cancelar</button>
                </div>
              </form>
            </section>
            <section class="card narrow">
              <h3>Estado actual</h3>
              <p>
                <span
                  :class="[
                    'status',
                    celdaEditando.estado_ocupacion === 'OCUPADA'
                      ? 'occupied-pill'
                      : celdaEditando.estado_ocupacion === 'INHABILITADA'
                        ? 'inactive'
                        : '',
                  ]"
                >
                  {{ celdaEditando.estado_ocupacion }}
                </span>
              </p>
              <p v-if="celdaEditando.placa_actual">
                <strong>Vehículo actual:</strong> {{ celdaEditando.placa_actual }} ({{
                  celdaEditando.tipo_vehiculo_actual || 'ACTIVO'
                }})
              </p>
              <p v-else>Sin permanencia activa.</p>
              <p>
                La modificación o cambio de estado solo se guarda si no contradice una ocupación existente.
              </p>
            </section>
          </div>

          <!-- D12: Bloqueos y reglas de celda ocupada -->
          <div v-else-if="vistaCeldas === 'bloqueo' && celdaEditando" class="split wide">
            <section class="card">
              <h3>Restricción de cambio sobre celda ocupada</h3>
              <p>
                <span class="status occupied-pill">{{ celdaEditando.codigo }} · Ocupada</span>
              </p>
              <p><strong>Vehículo actual: {{ celdaEditando.placa_actual || 'En permanencia activa' }}</strong></p>
              <p class="muted">Tipo de celda: {{ celdaEditando.tipo }}</p>
              <div class="info-inline bad" style="margin: 18px 0">
                ! No se puede deshabilitar una celda con permanencia activa ni asignarle un tipo incompatible.
              </div>
              <div class="button-row">
                <button class="btn primary" @click="vistaCeldas = 'mapa'">Entendido</button>
              </div>
            </section>
            <section class="card narrow">
              <h3>Controles del sistema</h3>
              <p>1. Código único</p>
              <p>2. Tipo de vehículo compatible</p>
              <p>3. Celda habilitada</p>
              <p>4. Sin ocupación activa</p>
              <p>5. Acción registrada en auditoría</p>
              <div class="info-inline">Validación obligatoria en API.</div>
            </section>
          </div>
        </template>

        <!-- ================================================================== -->
        <!-- VISTAS ITERACIÓN 1: VEHÍCULOS, ENTRADA, ACTIVOS, SALIDA, ETC.      -->
        <!-- ================================================================== -->
        <template v-else-if="pagina === 'registroVehiculo'">
          <div class="split wide">
            <section class="card">
              <h3>Datos del vehículo</h3>
              <p class="muted">
                Registra el vehículo a nombre de un cliente existente. Este proceso no registra su entrada al
                parqueadero.
              </p>
              <form class="form-grid" @submit.prevent="guardarVehiculo">
                <label>
                  Placa *
                  <input
                    v-model="nuevoVehiculo.placa"
                    required
                    minlength="5"
                    maxlength="10"
                    placeholder="ABC123"
                    autocomplete="off"
                  />
                </label>
                <label>
                  Tipo de vehículo *
                  <select v-model="nuevoVehiculo.tipo" required>
                    <option value="AUTOMOVIL">Automóvil</option>
                    <option value="MOTOCICLETA">Motocicleta</option>
                    <option value="CAMIONETA">Camioneta</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </label>
                <label>
                  Color
                  <input v-model.trim="nuevoVehiculo.color" maxlength="35" placeholder="Ej. Blanco" />
                </label>
                <label>
                  Cliente propietario *
                  <select v-model="nuevoVehiculo.clienteId" required>
                    <option value="">Selecciona un cliente</option>
                    <option v-for="c in clientes" :key="c.id" :value="String(c.id)" :disabled="c.activo !== 1">
                      {{ c.nombre }} · {{ c.documento }}{{ c.activo === 1 ? '' : ' · INACTIVO' }}
                    </option>
                  </select>
                </label>
                <label>
                  Estado de autorización *
                  <select v-model="nuevoVehiculo.autorizado" required>
                    <option :value="true">Autorizado</option>
                    <option :value="false">No autorizado</option>
                  </select>
                </label>
                <label>
                  Fecha de vencimiento *
                  <input v-model="nuevoVehiculo.autorizacionHasta" type="date" required />
                </label>
                <div class="info-inline">
                  La entrada solo será permitida si el cliente continúa activo, el vehículo está autorizado y la fecha
                  de vencimiento sigue vigente.
                </div>
                <div class="button-row">
                  <button class="btn primary" :disabled="trabajando || !clientes.some(c => c.activo === 1)">
                    {{ trabajando ? 'Guardando…' : 'Registrar vehículo' }}
                  </button>
                  <button
                    type="button"
                    class="btn secondary"
                    @click="
                      nuevoVehiculo = {
                        placa: '',
                        tipo: 'AUTOMOVIL',
                        color: '',
                        clienteId: '',
                        autorizado: true,
                        autorizacionHasta: '',
                      };
                      vehiculoRegistrado = null;
                    "
                  >
                    Limpiar
                  </button>
                </div>
              </form>
            </section>
            <section class="card narrow">
              <template v-if="vehiculoRegistrado">
                <h3>Vehículo registrado</h3>
                <div :class="['info-inline', vehiculoRegistrado.vigente ? 'good' : 'warn']">
                  <strong>{{ vehiculoRegistrado.placa }}</strong><br />
                  {{ vehiculoRegistrado.tipo }} · {{ vehiculoRegistrado.cliente }}<br />
                  {{ vehiculoRegistrado.vigente ? 'Autorización vigente' : 'Sin autorización vigente' }}
                </div>
                <div class="button-row">
                  <button class="btn primary" :disabled="!vehiculoRegistrado.vigente" @click="registrarEntradaDelNuevo">
                    Registrar entrada
                  </button>
                </div>
                <p v-if="!vehiculoRegistrado.vigente" class="muted">
                  La entrada permanece bloqueada hasta que la autorización y la mensualidad estén vigentes.
                </p>
              </template>
              <template v-else>
                <h3>Validaciones del registro</h3>
                <p>✓ Placa única</p>
                <p>✓ Cliente existente y activo</p>
                <p>✓ Tipo compatible con MySQL</p>
                <p>✓ Autorización y vencimiento conservados</p>
              </template>
            </section>
          </div>
        </template>

        <template v-else-if="pagina === 'entrada'">
          <div class="split wide">
            <section class="card">
              <h3>Datos del ingreso</h3>
              <p class="muted">La fecha y la hora se generan automáticamente en el servidor.</p>
              <form class="form-grid" @submit.prevent="confirmarEntrada">
                <label>
                  Placa del vehículo *
                  <div class="field-action">
                    <input
                      v-model="entrada.placa"
                      required
                      maxlength="10"
                      placeholder="ABC123"
                      @input="vehiculoActual = null"
                    />
                    <button type="button" class="btn secondary" @click="verificarPlaca">Verificar placa</button>
                  </div>
                </label>
                <div v-if="vehiculoActual" :class="['info-inline', vehiculoActual.vigente ? 'good' : 'bad']">
                  <strong>{{ vehiculoActual.placa }}</strong> · {{ vehiculoActual.tipo }} · {{ vehiculoActual.cliente
                  }}<br />
                  {{ vehiculoActual.vigente ? 'Autorizado' : 'No autorizado o vencido' }}
                </div>
                <label>
                  Celda disponible *
                  <select v-model="entrada.codigoCelda" required>
                    <option value="">Selecciona una celda</option>
                    <option v-for="c in celdasDisponibles" :key="c.id" :value="c.codigo">
                      {{ c.codigo }} ({{ c.tipo }})
                    </option>
                  </select>
                </label>
                <div class="info-inline">
                  El operador se registra automáticamente: {{ sesion.nombre }}. No se permiten entradas duplicadas.
                </div>
                <div class="button-row">
                  <button class="btn primary" :disabled="trabajando">Confirmar entrada</button>
                  <button
                    type="button"
                    class="btn secondary"
                    @click="
                      entrada = {placa: '', codigoCelda: ''};
                      vehiculoActual = null;
                    "
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </section>
            <section class="card narrow">
              <h3>Resumen de disponibilidad</h3>
              <strong class="big-number">{{ panel.disponibles }}</strong>
              <p class="muted">Celdas disponibles</p>
              <hr />
              <h4>Verificaciones</h4>
              <p>✓ Vehículo autorizado</p>
              <p>✓ Sin ingreso activo</p>
              <p>✓ Celda libre</p>
              <p>✓ Tipo compatible</p>
            </section>
          </div>
        </template>

        <template v-else-if="pagina === 'activos'">
          <section class="card">
            <div class="card-head">
              <div>
                <h3>Permanencias activas</h3>
                <p class="muted">{{ activos.length }} vehículos actualmente dentro</p>
              </div>
              <button class="btn primary" @click="cargarPagina('salida')">Registrar salida</button>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>PLACA</th>
                    <th>TIPO</th>
                    <th>CELDA</th>
                    <th>ENTRADA</th>
                    <th>DURACIÓN</th>
                    <th>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in activos" :key="m.id">
                    <td><strong>{{ m.placa }}</strong></td>
                    <td>{{ m.tipo }}</td>
                    <td>{{ m.celda }}</td>
                    <td>{{ fecha(m.fecha_entrada_utc) }}</td>
                    <td>{{ tiempo(m.minutos) }}</td>
                    <td>
                      <button
                        class="linkish"
                        @click="
                          salida.placa = m.placa;
                          cargarPagina('salida');
                        "
                      >
                        Registrar salida
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!activos.length">
                    <td colspan="6" class="empty">No hay permanencias activas.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <template v-else-if="pagina === 'salida'">
          <div class="split wide">
            <section class="card">
              <h3>Identificar permanencia</h3>
              <p class="muted">Busca por placa para verificar los datos antes de confirmar.</p>
              <form class="form-grid" @submit.prevent="confirmarSalida">
                <label>
                  Placa del vehículo *
                  <input v-model="salida.placa" placeholder="ABC123" list="placas-activas" required />
                </label>
                <datalist id="placas-activas">
                  <option v-for="m in activos" :key="m.id" :value="m.placa" />
                </datalist>
                <div v-if="salidaActual" class="info-inline good">
                  <strong>Ingreso activo · MOV-{{ salidaActual.id }}</strong><br />
                  Celda {{ salidaActual.celda }} · {{ salidaActual.tipo }}<br />
                  Entrada: {{ fecha(salidaActual.fecha_entrada_utc) }}<br />
                  Tiempo transcurrido: {{ tiempo(salidaActual.minutos) }}
                </div>
                <div v-else-if="salida.placa" class="info-inline bad">
                  No se encontró ninguna permanencia activa para esta placa.
                </div>
                <div class="button-row">
                  <button class="btn primary" :disabled="!salidaActual || trabajando">Confirmar salida</button>
                </div>
              </form>
            </section>
            <section class="card narrow">
              <h3>Resultado esperado</h3>
              <p>✓ Cerrar permanencia activa</p>
              <p>✓ Registrar fecha y operador</p>
              <p>✓ Liberar celda automáticamente</p>
              <p>✓ Actualizar historial</p>
              <div class="info-inline warn">No se procesan pagos en esta iteración.</div>
            </section>
          </div>
        </template>

        <template v-else-if="pagina === 'historial'">
          <section class="card">
            <form class="filter-grid" @submit.prevent="trabajo(buscarHistorial)">
              <label>
                Placa
                <input v-model="filtrado.placa" placeholder="Buscar por placa…" />
              </label>
              <label>
                Estado
                <select v-model="filtrado.estado">
                  <option value="">Todos</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="FINALIZADO">Finalizado</option>
                </select>
              </label>
              <label>
                Desde
                <input v-model="filtrado.desde" type="date" />
              </label>
              <label>
                Hasta
                <input v-model="filtrado.hasta" type="date" />
              </label>
              <button class="btn primary">Aplicar filtros</button>
            </form>
            <h3>Movimientos registrados</h3>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>REGISTRO</th>
                    <th>PLACA</th>
                    <th>CELDA</th>
                    <th>ENTRADA</th>
                    <th>SALIDA</th>
                    <th>ESTADO</th>
                    <th>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in historial" :key="m.id">
                    <td>MOV-{{ m.id }}</td>
                    <td><strong>{{ m.placa }}</strong></td>
                    <td>{{ m.celda }}</td>
                    <td>{{ fecha(m.fecha_entrada_utc) }}</td>
                    <td>{{ fecha(m.fecha_salida_utc) }}</td>
                    <td>
                      <span :class="['status', m.estado === 'FINALIZADO' ? 'ended' : '']">{{ m.estado }}</span>
                    </td>
                    <td><button class="linkish" @click="verDetalle(m.id)">Ver detalle</button></td>
                  </tr>
                  <tr v-if="!historial.length">
                    <td colspan="7" class="empty">No hay resultados con estos filtros.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <template v-else-if="pagina === 'novedades'">
          <div class="split wide">
            <section class="card">
              <h3>Nueva novedad</h3>
              <p class="muted">La incidencia quedará asociada a una permanencia activa.</p>
              <form class="form-grid" @submit.prevent="guardarNovedad">
                <label>
                  Vehículo / permanencia *
                  <select v-model="novedad.movimientoId" required>
                    <option value="">Selecciona un ingreso activo</option>
                    <option v-for="m in activos" :key="m.id" :value="String(m.id)">
                      {{ m.placa }} · MOV-{{ m.id }}
                    </option>
                  </select>
                </label>
                <label>
                  Tipo de novedad *
                  <select v-model="novedad.tipo">
                    <option value="OBSERVACION">Observación general</option>
                    <option value="INCIDENTE">Incidente</option>
                    <option value="ACCESO">Acceso</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </label>
                <label>
                  Descripción *
                  <textarea
                    v-model="novedad.descripcion"
                    minlength="5"
                    maxlength="2000"
                    rows="5"
                    required
                    placeholder="Describe la situación registrada…"
                  ></textarea>
                </label>
                <p class="muted">Fecha y operador registrados automáticamente.</p>
                <button class="btn primary" :disabled="trabajando">Guardar novedad</button>
              </form>
            </section>
            <section class="card narrow">
              <h3>Novedades recientes</h3>
              <div v-for="n in novedades.slice(0, 8)" :key="n.id" class="notice">
                <strong>{{ n.placa }} · {{ n.tipo }}</strong>
                <p>{{ n.descripcion }}</p>
                <small>{{ fecha(n.fecha_utc) }} · {{ n.operador }}</small>
              </div>
              <div v-if="!novedades.length" class="empty">No hay novedades.</div>
            </section>
          </div>
        </template>

        <!-- ================================================================== -->
        <!-- D13: AUDITORÍA ADMINISTRATIVA Y OPERATIVA                          -->
        <!-- ================================================================== -->
        <template v-else-if="pagina === 'auditoria'">
          <section class="card">
            <h3>Registro de actividades</h3>
            <p class="muted">
              Las acciones quedan vinculadas al usuario autenticado y a la fecha UTC del servidor.
            </p>
            <form class="filter-grid" @submit.prevent="trabajo(buscarAuditoria)">
              <label>
                Buscar entidad o usuario
                <input v-model.trim="filtroAuditoria.q" placeholder="Filtrar por usuario, acción o ID…" />
              </label>
              <label>
                Módulo
                <select v-model="filtroAuditoria.entidad">
                  <option value="">Todos</option>
                  <option value="usuarios">Cuentas (usuarios)</option>
                  <option value="clientes">Clientes</option>
                  <option value="celdas">Celdas</option>
                  <option value="vehiculos">Vehículos</option>
                  <option value="movimientos">Movimientos</option>
                  <option value="novedades">Novedades</option>
                </select>
              </label>
              <label>
                Periodo
                <select v-model="filtroAuditoria.dias">
                  <option value="">Todo el historial</option>
                  <option value="1">Últimas 24 horas</option>
                  <option value="7">Últimos 7 días</option>
                  <option value="30">Últimos 30 días</option>
                </select>
              </label>
              <label>
                Desde
                <input v-model="filtroAuditoria.desde" type="date" />
              </label>
              <div class="button-row">
                <button class="btn primary" type="submit">Filtrar</button>
                <button
                  class="btn secondary"
                  type="button"
                  @click="
                    filtroAuditoria = {q: '', entidad: '', dias: '', desde: '', hasta: ''};
                    trabajo(buscarAuditoria);
                  "
                >
                  Todos
                </button>
              </div>
            </form>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>FECHA</th>
                    <th>RESPONSABLE</th>
                    <th>OPERACIÓN</th>
                    <th>ENTIDAD</th>
                    <th>DETALLES</th>
                    <th>RESULTADO</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="a in auditoria" :key="a.id">
                    <td>{{ fecha(a.fecha_utc) }}</td>
                    <td>{{ a.operador }}</td>
                    <td><strong>{{ a.accion }}</strong></td>
                    <td>{{ a.entidad }} #{{ a.registro_id }}</td>
                    <td class="detail-cell">{{ formatearDetallesAuditoria(a.detalles) }}</td>
                    <td><span class="status">Registrado</span></td>
                  </tr>
                  <tr v-if="!auditoria.length">
                    <td colspan="6" class="empty">No hay registros de auditoría para los filtros seleccionados.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </div>

      <footer class="footer">
        Autos Colombia · Iteraciones 1 y 2
        <span>Sistema integrado · Persistencia MySQL 8</span>
      </footer>
    </main>
  </div>

  <!-- MODAL DETALLE MOVIMIENTO (Iteración 1) -->
  <div v-if="detalle" class="modal-backdrop" @click.self="detalle = null">
    <section class="modal" role="dialog" aria-modal="true" aria-label="Detalle del movimiento">
      <div class="card-head">
        <h2>Movimiento MOV-{{ detalle.id }}</h2>
        <button class="icon-button" aria-label="Cerrar" @click="detalle = null">×</button>
      </div>
      <span :class="['status', detalle.estado === 'FINALIZADO' ? 'ended' : '']">{{ detalle.estado }}</span>
      <div class="detail-grid">
        <div>
          <small>PLACA</small><strong>{{ detalle.placa }}</strong>
        </div>
        <div>
          <small>TIPO</small><strong>{{ detalle.tipo }}</strong>
        </div>
        <div>
          <small>CELDA</small><strong>{{ detalle.celda }}</strong>
        </div>
        <div>
          <small>ENTRADA</small><strong>{{ fecha(detalle.fecha_entrada_utc) }}</strong>
        </div>
        <div>
          <small>SALIDA</small><strong>{{ fecha(detalle.fecha_salida_utc) }}</strong>
        </div>
        <div>
          <small>OPERADORES</small>
          <strong>{{ detalle.operador_entrada }} / {{ detalle.operador_salida || '—' }}</strong>
        </div>
      </div>
      <h3>Novedades asociadas</h3>
      <div v-if="!detalle.novedades?.length" class="muted">Sin novedades registradas</div>
      <div v-for="n in detalle.novedades" :key="n.id" class="notice">
        <strong>{{ n.tipo }}</strong> · {{ n.descripcion }} <small>{{ fecha(n.fecha_utc) }}</small>
      </div>
    </section>
  </div>

  <!-- MODAL FICHA DE CLIENTE (Iteración 2) -->
  <div v-if="detalleClienteModal" class="modal-backdrop" @click.self="detalleClienteModal = null">
    <section class="modal" role="dialog" aria-modal="true" aria-label="Ficha del cliente">
      <div class="card-head">
        <h2>Cliente · {{ detalleClienteModal.nombre }}</h2>
        <button class="icon-button" aria-label="Cerrar" @click="detalleClienteModal = null">×</button>
      </div>
      <span :class="['status', detalleClienteModal.activo === 1 ? '' : 'inactive']">
        {{ detalleClienteModal.activo === 1 ? 'Activo' : 'Inactivo' }}
      </span>
      <div class="detail-grid">
        <div>
          <small>DOCUMENTO</small><strong>{{ detalleClienteModal.documento }}</strong>
        </div>
        <div>
          <small>TELÉFONO</small><strong>{{ detalleClienteModal.telefono || '—' }}</strong>
        </div>
        <div>
          <small>CORREO</small><strong>{{ detalleClienteModal.correo || '—' }}</strong>
        </div>
        <div>
          <small>VEHÍCULOS ASOCIADOS</small><strong>{{ detalleClienteModal.total_vehiculos ?? 0 }}</strong>
        </div>
      </div>
      <h3>Vehículos registrados</h3>
      <div v-if="!detalleClienteModal.vehiculos?.length" class="muted">Sin vehículos registrados para este cliente.</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>PLACA</th>
              <th>TIPO</th>
              <th>VENCIMIENTO</th>
              <th>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in detalleClienteModal.vehiculos" :key="v.id">
              <td><strong>{{ v.placa }}</strong></td>
              <td>{{ v.tipo }}</td>
              <td>{{ v.autorizacion_hasta }}</td>
              <td>
                <span :class="['status', v.vigente ? '' : 'inactive']">
                  {{ v.vigente ? 'Vigente' : 'No vigente' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <!-- MODAL DETALLE DE CELDA SOLO LECTURA (Operador D14) -->
  <div v-if="detalleCeldaModal" class="modal-backdrop" @click.self="detalleCeldaModal = null">
    <section class="modal" role="dialog" aria-modal="true" aria-label="Detalle de celda">
      <div class="card-head">
        <h2>Celda {{ detalleCeldaModal.codigo }}</h2>
        <button class="icon-button" aria-label="Cerrar" @click="detalleCeldaModal = null">×</button>
      </div>
      <span
        :class="[
          'status',
          detalleCeldaModal.estado_ocupacion === 'OCUPADA'
            ? 'occupied-pill'
            : detalleCeldaModal.estado_ocupacion === 'INHABILITADA'
              ? 'inactive'
              : '',
        ]"
      >
        {{ detalleCeldaModal.estado_ocupacion }}
      </span>
      <div class="detail-grid">
        <div>
          <small>CÓDIGO</small><strong>{{ detalleCeldaModal.codigo }}</strong>
        </div>
        <div>
          <small>TIPO COMPATIBLE</small><strong>{{ detalleCeldaModal.tipo }}</strong>
        </div>
        <div>
          <small>HABILITACIÓN</small>
          <strong>{{ Number(detalleCeldaModal.habilitada) === 1 ? 'Habilitada' : 'Deshabilitada' }}</strong>
        </div>
        <div>
          <small>VEHÍCULO ACTUAL</small><strong>{{ detalleCeldaModal.placa_actual || 'Ninguno (libre)' }}</strong>
        </div>
      </div>
      <div class="info-inline">
        Modo consulta de operador. Para modificar el tipo o estado de la celda se requiere rol ADMIN.
      </div>
    </section>
  </div>
</template>
