<script setup>
import {onMounted,ref,computed} from 'vue';
import {api,formatearFecha,tiempo} from './api';

const nav=[
 {id:'panel',icon:'▦',label:'Panel de operación'},
 {id:'registroVehiculo',icon:'+',label:'Registrar vehículo'},
 {id:'entrada',icon:'↗',label:'Registrar entrada'},
 {id:'activos',icon:'▤',label:'Vehículos dentro'},
 {id:'salida',icon:'↘',label:'Registrar salida'},
 {id:'historial',icon:'◷',label:'Historial'},
 {id:'novedades',icon:'◎',label:'Novedades'},
];
const pagina=ref('panel'), sesion=ref(null), cargando=ref(true), trabajando=ref(false), mensaje=ref(null), detalle=ref(null);
const login=ref({usuario:'',contrasena:''});
const panel=ref({total:0,ocupadas:0,disponibles:0,entradas_hoy:0});
const activos=ref([]), celdas=ref([]), vehiculos=ref([]), historial=ref([]), novedades=ref([]), auditoria=ref([]);
const entrada=ref({placa:'',codigoCelda:''}), salida=ref({placa:''}), novedad=ref({movimientoId:'',tipo:'OBSERVACION',descripcion:''});
const clientes=ref([]), vehiculoRegistrado=ref(null);
const nuevoVehiculo=ref({placa:'',tipo:'AUTOMOVIL',color:'',clienteId:'',autorizado:true,autorizacionHasta:''});
const filtrado=ref({placa:'',estado:'',desde:'',hasta:''});
const vehiculoActual=ref(null);
const salidaActual=computed(()=>activos.value.find(x=>x.placa===salida.value.placa.trim().toUpperCase())||null);
const celdasDisponibles=computed(()=>celdas.value.filter(c=>{
 if(c.estado_ocupacion!=='DISPONIBLE')return false;
 if(!vehiculoActual.value)return true;
 return c.tipo==='MIXTA'||(vehiculoActual.value.tipo==='MOTOCICLETA'?c.tipo==='MOTOCICLETA':c.tipo==='AUTOMOVIL');
}));
function alertar(texto,kind='success'){mensaje.value={texto,kind};}
async function trabajo(fn){trabajando.value=true;mensaje.value=null;try{await fn();}catch(e){alertar(e.message,'error');if(e.status===401){sesion.value=null;pagina.value='panel';}}finally{trabajando.value=false;}}
async function recargar(){
 const [p,a,c]=await Promise.all([api('/dashboard'),api('/movimientos?estado=ACTIVO'),api('/celdas')]);
 panel.value=p;activos.value=a;celdas.value=c;
}
async function cargarPagina(id){pagina.value=id;detalle.value=null;await trabajo(async()=>{
 if(!sesion.value)return;
 await recargar();
 if(id==='registroVehiculo')clientes.value=await api('/clientes');
 if(id==='historial')await buscarHistorial();
 if(id==='novedades')novedades.value=await api('/novedades');
 if(id==='auditoria')auditoria.value=await api('/auditoria');
});}
async function ingresar(){await trabajo(async()=>{
 const data=await api('/auth/login',{method:'POST',body:login.value});
 sesion.value=data.usuario;login.value.contrasena='';pagina.value='panel';await recargar();
 alertar('Bienvenido al sistema, '+sesion.value.nombre);
});}
async function salirSesion(){await trabajo(async()=>{await api('/auth/logout',{method:'POST'});sesion.value=null;pagina.value='panel';});}
async function verificarPlaca(){await trabajo(async()=>{
 const placa=entrada.value.placa.trim().toUpperCase();if(!placa){vehiculoActual.value=null;return;}
 const rows=await api('/vehiculos?placa='+encodeURIComponent(placa));
 vehiculoActual.value=rows.find(v=>v.placa===placa)||null;
 entrada.value.codigoCelda='';
 alertar(vehiculoActual.value?(vehiculoActual.value.vigente?'Vehículo autorizado. Selecciona una celda.':'Vehículo no autorizado o mensualidad vencida.'):'La placa no está registrada.',vehiculoActual.value?.vigente?'success':'error');
});}
async function guardarVehiculo(){await trabajo(async()=>{
 vehiculoRegistrado.value=null;
 const data=await api('/vehiculos',{method:'POST',body:nuevoVehiculo.value});
 vehiculoRegistrado.value=data.vehiculo;
 nuevoVehiculo.value={placa:'',tipo:'AUTOMOVIL',color:'',clienteId:'',autorizado:true,autorizacionHasta:''};
 alertar(data.mensaje);
});}
async function registrarEntradaDelNuevo(){
 const vehiculo=vehiculoRegistrado.value;
 if(!vehiculo?.vigente)return;
 await cargarPagina('entrada');
 entrada.value={placa:vehiculo.placa,codigoCelda:''};
 vehiculoActual.value=vehiculo;
 alertar(`Placa ${vehiculo.placa} conservada. Selecciona una celda disponible.`);
}
async function confirmarEntrada(){await trabajo(async()=>{
 const data=await api('/movimientos/entrada',{method:'POST',body:entrada.value});
 alertar(`Entrada MOV-${data.id} registrada correctamente.`);entrada.value={placa:'',codigoCelda:''};vehiculoActual.value=null;await recargar();
});}
async function confirmarSalida(){await trabajo(async()=>{
 if(!salidaActual.value)throw new Error('Primero busca una placa con entrada activa.');
 await api(`/movimientos/${salidaActual.value.id}/salida`,{method:'POST'});
 alertar('Salida registrada. La celda quedó disponible.');salida.value.placa='';await recargar();
});}
async function buscarHistorial(){const params=new URLSearchParams(Object.fromEntries(Object.entries(filtrado.value).filter(([_,v])=>v)));
 historial.value=await api('/movimientos'+(params.size?'?'+params.toString():''));}
async function guardarNovedad(){await trabajo(async()=>{
 await api('/novedades',{method:'POST',body:novedad.value});
 novedad.value={movimientoId:'',tipo:'OBSERVACION',descripcion:''};
 novedades.value=await api('/novedades');alertar('Novedad registrada correctamente.');
});}
async function verDetalle(id){await trabajo(async()=>{detalle.value=await api('/movimientos/'+id);});}
const fecha=formatearFecha;
const titulo=computed(()=>nav.find(n=>n.id===pagina.value)?.label||(pagina.value==='auditoria'?'Auditoría':'Panel de operación'));
onMounted(async()=>{try{const d=await api('/auth/me');sesion.value=d.usuario;await recargar();}catch{}finally{cargando.value=false;}});
</script>

<template>
<div v-if="cargando" class="splash">Iniciando Autos Colombia…</div>
<div v-else-if="!sesion" class="login-shell">
  <section class="login-hero">
    <div class="brand"><span class="brand-mark">AC</span><span>AUTOS COLOMBIA<small>SISTEMA DE INFORMACIÓN</small></span></div>
    <div class="hero-content"><div class="eyebrow">PARQUEADERO · ITERACIÓN 1</div><h1>Control inteligente<br>del parqueadero.</h1>
      <p>Registra movimientos, consulta la ocupación y mantén la trazabilidad de cada vehículo.</p>
      <div class="parking-map"><div v-for="i in 10" :key="i" class="parking-space" :class="i%3===0?'filled':''">{{String(i).padStart(2,'0')}}</div></div>
    </div><span class="hero-foot">Autos Colombia · Gestión de entradas y salidas</span>
  </section>
  <section class="login-panel"><form class="login-card" @submit.prevent="ingresar">
     <div class="eyebrow teal">ACCESO AUTORIZADO</div><h2>Bienvenido de nuevo</h2><p class="muted">Accede con tu cuenta de operador.</p>
     <label>Usuario <input v-model.trim="login.usuario" autocomplete="username" required placeholder="Ingresa tu usuario" /></label>
     <label>Contraseña <input v-model="login.contrasena" type="password" autocomplete="current-password" required placeholder="••••••••"/></label>
     <p v-if="mensaje?.kind==='error'" class="alert error" role="alert">{{mensaje.texto}}</p>
     <button class="btn primary fill" :disabled="trabajando">{{trabajando?'Validando…':'Iniciar sesión'}}</button>
     <small class="muted centered">Acceso exclusivo para personal autorizado.</small>
  </form><small class="login-note">Versión académica · Conexión real a MySQL</small></section>
</div>
<div v-else class="app-shell">
 <aside class="sidebar">
  <div class="brand small"><span class="brand-mark">AC</span><span>AUTOS COLOMBIA<small>OPERACIÓN</small></span></div>
  <span class="side-title">NAVEGACIÓN</span>
  <nav aria-label="Menú principal"><button v-for="item in nav" :key="item.id" :class="['nav-item',{selected:pagina===item.id}]" @click="cargarPagina(item.id)"><span>{{item.icon}}</span>{{item.label}}</button>
    <button v-if="sesion.rol==='ADMIN'" :class="['nav-item',{selected:pagina==='auditoria'}]" @click="cargarPagina('auditoria')"><span>☷</span> Auditoría</button>
  </nav>
  <div class="side-bottom"><div class="badge-lite">Sistema operativo · Local</div>
    <button class="nav-item" @click="salirSesion"><span>⇥</span> Cerrar sesión</button>
    <div class="operator"><span class="avatar">{{sesion.nombre.charAt(0).toUpperCase()}}</span><div><strong>{{sesion.nombre}}</strong><small>Rol: {{sesion.rol.toLowerCase()}}</small></div></div>
  </div>
 </aside>
 <main class="workspace">
  <header class="topbar"><span>Autos Colombia / Iteración 1</span><div><span class="top-pill">Operación activa</span><span class="avatar tiny">{{sesion.nombre.charAt(0).toUpperCase()}}</span></div></header>
  <div class="content"><div class="page-header"><div><p class="eyebrow teal">CONTROL DE ACCESO VEHICULAR</p><h1>{{titulo}}</h1><p class="muted">{{pagina==='panel'?'Resumen de ocupación y movimientos del parqueadero.':'Gestión de vehículos y trazabilidad de la primera iteración.'}}</p></div>
    <button v-if="pagina==='panel'||pagina==='activos'" class="btn primary" @click="cargarPagina('entrada')">+ Registrar entrada</button></div>
  <p v-if="mensaje" :class="['alert',mensaje.kind]" role="status"><span>{{mensaje.kind==='success'?'✓':'!'}}</span>{{mensaje.texto}}<button @click="mensaje=null" aria-label="Cerrar mensaje">×</button></p>

  <template v-if="pagina==='panel'"><div class="stat-grid">
    <article class="stat-card"><span class="stat-caption">Celdas habilitadas</span><strong>{{panel.total}}</strong><small>Capacidad operativa</small></article>
    <article class="stat-card orange"><span class="stat-caption">Ocupadas</span><strong>{{panel.ocupadas}}</strong><small>{{panel.total?Math.round(panel.ocupadas/panel.total*100):0}} % ocupación</small></article>
    <article class="stat-card green"><span class="stat-caption">Disponibles</span><strong>{{panel.disponibles}}</strong><small>Listas para asignar</small></article>
    <article class="stat-card"><span class="stat-caption">Entradas hoy</span><strong>{{panel.entradas_hoy}}</strong><small>Horario de Colombia</small></article>
  </div><div class="split wide"><section class="card"><div class="card-head"><div><h3>Vehículos dentro</h3><p class="muted">Últimos ingresos activos</p></div><button class="linkish" @click="cargarPagina('activos')">Ver todos →</button></div>
    <div class="table-wrap"><table><thead><tr><th>PLACA</th><th>CELDA</th><th>INGRESO</th><th>ESTADO</th><th>ACCIÓN</th></tr></thead><tbody>
     <tr v-for="m in activos.slice(0,7)" :key="m.id"><td><strong>{{m.placa}}</strong></td><td>{{m.celda}}</td><td>{{fecha(m.fecha_entrada_utc,false)}}</td><td><span class="status">Activo</span></td><td><button class="linkish" @click="verDetalle(m.id)">Ver detalle</button></td></tr>
     <tr v-if="!activos.length"><td colspan="5" class="empty">No hay vehículos dentro del parqueadero.</td></tr>
    </tbody></table></div></section><section class="card quick"><h3>Acciones rápidas</h3><button @click="cargarPagina('entrada')">↗ Registrar entrada <small>Asignar celda</small></button><button @click="cargarPagina('salida')">↘ Registrar salida <small>Cerrar permanencia</small></button><button @click="cargarPagina('historial')">◷ Consultar historial <small>Movimientos anteriores</small></button></section></div></template>

  <template v-else-if="pagina==='registroVehiculo'"><div class="split wide"><section class="card"><h3>Datos del vehículo</h3><p class="muted">Registra el vehículo a nombre de un cliente existente. Este proceso no registra su entrada al parqueadero.</p>
    <form @submit.prevent="guardarVehiculo" class="form-grid">
      <label>Placa *<input v-model="nuevoVehiculo.placa" required minlength="5" maxlength="10" placeholder="ABC123" autocomplete="off"/></label>
      <label>Tipo de vehículo *<select v-model="nuevoVehiculo.tipo" required><option value="AUTOMOVIL">Automóvil</option><option value="MOTOCICLETA">Motocicleta</option><option value="CAMIONETA">Camioneta</option><option value="OTRO">Otro</option></select></label>
      <label>Color <input v-model.trim="nuevoVehiculo.color" maxlength="35" placeholder="Ej. Blanco"/></label>
      <label>Cliente propietario *<select v-model="nuevoVehiculo.clienteId" required><option value="">Selecciona un cliente</option><option v-for="c in clientes" :key="c.id" :value="String(c.id)" :disabled="c.activo!==1">{{c.nombre}} · {{c.documento}}{{c.activo===1?'':' · INACTIVO'}}</option></select></label>
      <label>Estado de autorización *<select v-model="nuevoVehiculo.autorizado" required><option :value="true">Autorizado</option><option :value="false">No autorizado</option></select></label>
      <label>Fecha de vencimiento *<input v-model="nuevoVehiculo.autorizacionHasta" type="date" required/></label>
      <div class="info-inline">La entrada solo será permitida si el cliente continúa activo, el vehículo está autorizado y la fecha de vencimiento sigue vigente.</div>
      <div class="button-row"><button class="btn primary" :disabled="trabajando||!clientes.some(c=>c.activo===1)">{{trabajando?'Guardando…':'Registrar vehículo'}}</button><button type="button" class="btn secondary" @click="nuevoVehiculo={placa:'',tipo:'AUTOMOVIL',color:'',clienteId:'',autorizado:true,autorizacionHasta:''};vehiculoRegistrado=null">Limpiar</button></div>
    </form></section><section class="card narrow"><template v-if="vehiculoRegistrado"><h3>Vehículo registrado</h3><div :class="['info-inline',vehiculoRegistrado.vigente?'good':'warn']"><strong>{{vehiculoRegistrado.placa}}</strong><br>{{vehiculoRegistrado.tipo}} · {{vehiculoRegistrado.cliente}}<br>{{vehiculoRegistrado.vigente?'Autorización vigente':'Sin autorización vigente'}}</div><div class="button-row"><button class="btn primary" :disabled="!vehiculoRegistrado.vigente" @click="registrarEntradaDelNuevo">Registrar entrada</button></div><p v-if="!vehiculoRegistrado.vigente" class="muted">La entrada permanece bloqueada hasta que la autorización y la mensualidad estén vigentes.</p></template><template v-else><h3>Validaciones del registro</h3><p>✓ Placa única</p><p>✓ Cliente existente y activo</p><p>✓ Tipo compatible con MySQL</p><p>✓ Autorización y vencimiento conservados</p></template></section></div></template>

  <template v-else-if="pagina==='entrada'"><div class="split wide"><section class="card"><h3>Datos del ingreso</h3><p class="muted">La fecha y la hora se generan automáticamente en el servidor.</p>
    <form @submit.prevent="confirmarEntrada" class="form-grid">
      <label>Placa del vehículo *<div class="field-action"><input v-model="entrada.placa" required maxlength="10" placeholder="ABC123" @input="vehiculoActual=null"/><button type="button" class="btn secondary" @click="verificarPlaca">Verificar placa</button></div></label>
      <div v-if="vehiculoActual" :class="['info-inline',vehiculoActual.vigente?'good':'bad']"><strong>{{vehiculoActual.placa}}</strong> · {{vehiculoActual.tipo}} · {{vehiculoActual.cliente}}<br>{{vehiculoActual.vigente?'Autorizado':'No autorizado o vencido'}}</div>
      <label>Celda disponible *<select v-model="entrada.codigoCelda" required><option value="">Selecciona una celda</option><option v-for="c in celdasDisponibles" :key="c.id" :value="c.codigo">{{c.codigo}} ({{c.tipo}})</option></select></label>
      <div class="info-inline">El operador se registra automáticamente: {{sesion.nombre}}. No se permiten entradas duplicadas.</div>
      <div class="button-row"><button class="btn primary" :disabled="trabajando">Confirmar entrada</button><button type="button" class="btn secondary" @click="entrada={placa:'',codigoCelda:''};vehiculoActual=null">Cancelar</button></div>
    </form></section><section class="card narrow"><h3>Resumen de disponibilidad</h3><strong class="big-number">{{panel.disponibles}}</strong><p class="muted">Celdas disponibles</p><hr/><h4>Verificaciones</h4><p>✓ Vehículo autorizado</p><p>✓ Sin ingreso activo</p><p>✓ Celda libre</p><p>✓ Tipo compatible</p></section></div></template>

  <template v-else-if="pagina==='activos'"><section class="card"><div class="card-head"><div><h3>Permanencias activas</h3><p class="muted">{{activos.length}} vehículos actualmente dentro</p></div><button class="btn primary" @click="cargarPagina('salida')">Registrar salida</button></div>
    <div class="table-wrap"><table><thead><tr><th>PLACA</th><th>TIPO</th><th>CELDA</th><th>ENTRADA</th><th>DURACIÓN</th><th>ACCIÓN</th></tr></thead><tbody>
      <tr v-for="m in activos" :key="m.id"><td><strong>{{m.placa}}</strong></td><td>{{m.tipo}}</td><td>{{m.celda}}</td><td>{{fecha(m.fecha_entrada_utc)}}</td><td>{{tiempo(m.minutos)}}</td><td><button class="linkish" @click="salida.placa=m.placa;cargarPagina('salida')">Registrar salida</button></td></tr>
      <tr v-if="!activos.length"><td colspan="6" class="empty">No hay permanencias activas.</td></tr></tbody></table></div>
  </section></template>

  <template v-else-if="pagina==='salida'"><div class="split wide"><section class="card"><h3>Identificar permanencia</h3><p class="muted">Busca por placa para verificar los datos antes de confirmar.</p><form class="form-grid" @submit.prevent="confirmarSalida">
   <label>Placa del vehículo *<input v-model="salida.placa" placeholder="ABC123" list="placas-activas" required/></label><datalist id="placas-activas"><option v-for="m in activos" :key="m.id" :value="m.placa"/></datalist>
   <div v-if="salidaActual" class="info-inline good"><strong>Ingreso activo · MOV-{{salidaActual.id}}</strong><br>Celda {{salidaActual.celda}} · {{salidaActual.tipo}}<br>Entrada: {{fecha(salidaActual.fecha_entrada_utc)}}<br>Tiempo transcurrido: {{tiempo(salidaActual.minutos)}}</div>
   <div v-else-if="salida.placa" class="info-inline bad">No se encontró ninguna permanencia activa para esta placa.</div>
   <div class="button-row"><button class="btn primary" :disabled="!salidaActual||trabajando">Confirmar salida</button></div>
  </form></section><section class="card narrow"><h3>Resultado esperado</h3><p>✓ Cerrar permanencia activa</p><p>✓ Registrar fecha y operador</p><p>✓ Liberar celda automáticamente</p><p>✓ Actualizar historial</p><div class="info-inline warn">No se procesan pagos en esta iteración.</div></section></div></template>

  <template v-else-if="pagina==='historial'"><section class="card"><form class="filter-grid" @submit.prevent="trabajo(buscarHistorial)">
   <label>Placa<input v-model="filtrado.placa" placeholder="Buscar por placa…"/></label><label>Estado<select v-model="filtrado.estado"><option value="">Todos</option><option value="ACTIVO">Activo</option><option value="FINALIZADO">Finalizado</option></select></label>
   <label>Desde<input type="date" v-model="filtrado.desde"/></label><label>Hasta<input type="date" v-model="filtrado.hasta"/></label><button class="btn primary">Aplicar filtros</button>
  </form><h3>Movimientos registrados</h3><div class="table-wrap"><table><thead><tr><th>REGISTRO</th><th>PLACA</th><th>CELDA</th><th>ENTRADA</th><th>SALIDA</th><th>ESTADO</th><th>ACCIÓN</th></tr></thead><tbody>
    <tr v-for="m in historial" :key="m.id"><td>MOV-{{m.id}}</td><td><strong>{{m.placa}}</strong></td><td>{{m.celda}}</td><td>{{fecha(m.fecha_entrada_utc)}}</td><td>{{fecha(m.fecha_salida_utc)}}</td><td><span :class="['status',m.estado==='FINALIZADO'?'ended':'']">{{m.estado}}</span></td><td><button class="linkish" @click="verDetalle(m.id)">Ver detalle</button></td></tr>
    <tr v-if="!historial.length"><td colspan="7" class="empty">No hay resultados con estos filtros.</td></tr></tbody></table></div></section></template>

  <template v-else-if="pagina==='novedades'"><div class="split wide"><section class="card"><h3>Nueva novedad</h3><p class="muted">La incidencia quedará asociada a una permanencia activa.</p><form class="form-grid" @submit.prevent="guardarNovedad">
    <label>Vehículo / permanencia *<select v-model="novedad.movimientoId" required><option value="">Selecciona un ingreso activo</option><option v-for="m in activos" :key="m.id" :value="String(m.id)">{{m.placa}} · MOV-{{m.id}}</option></select></label>
    <label>Tipo de novedad *<select v-model="novedad.tipo"><option value="OBSERVACION">Observación general</option><option value="INCIDENTE">Incidente</option><option value="ACCESO">Acceso</option><option value="OTRO">Otro</option></select></label>
    <label>Descripción *<textarea v-model="novedad.descripcion" minlength="5" maxlength="2000" rows="5" required placeholder="Describe la situación registrada…"></textarea></label>
    <p class="muted">Fecha y operador registrados automáticamente.</p><button class="btn primary" :disabled="trabajando">Guardar novedad</button>
   </form></section><section class="card narrow"><h3>Novedades recientes</h3><div v-for="n in novedades.slice(0,8)" :key="n.id" class="notice"><strong>{{n.placa}} · {{n.tipo}}</strong><p>{{n.descripcion}}</p><small>{{fecha(n.fecha_utc)}} · {{n.operador}}</small></div><div v-if="!novedades.length" class="empty">No hay novedades.</div></section></div></template>

  <template v-else-if="pagina==='auditoria'"><section class="card"><h3>Auditoría de operaciones</h3><div class="table-wrap"><table><thead><tr><th>ID</th><th>ACCIÓN</th><th>OPERADOR</th><th>ENTIDAD</th><th>FECHA</th></tr></thead><tbody><tr v-for="a in auditoria" :key="a.id"><td>{{a.id}}</td><td>{{a.accion}}</td><td>{{a.operador}}</td><td>{{a.entidad}} #{{a.registro_id}}</td><td>{{fecha(a.fecha_utc)}}</td></tr></tbody></table></div></section></template>
  </div><footer class="footer">Autos Colombia · Iteración 1 <span>Prototipo académico · Datos de MySQL</span></footer>
 </main>
</div>
<div v-if="detalle" class="modal-backdrop" @click.self="detalle=null"><section class="modal" role="dialog" aria-modal="true" aria-label="Detalle del movimiento"><div class="card-head"><h2>Movimiento MOV-{{detalle.id}}</h2><button class="icon-button" @click="detalle=null" aria-label="Cerrar">×</button></div>
 <span :class="['status',detalle.estado==='FINALIZADO'?'ended':'']">{{detalle.estado}}</span><div class="detail-grid"><div><small>PLACA</small><strong>{{detalle.placa}}</strong></div><div><small>TIPO</small><strong>{{detalle.tipo}}</strong></div><div><small>CELDA</small><strong>{{detalle.celda}}</strong></div><div><small>ENTRADA</small><strong>{{fecha(detalle.fecha_entrada_utc)}}</strong></div><div><small>SALIDA</small><strong>{{fecha(detalle.fecha_salida_utc)}}</strong></div><div><small>OPERADORES</small><strong>{{detalle.operador_entrada}} / {{detalle.operador_salida||'—'}}</strong></div></div>
 <h3>Novedades asociadas</h3><div v-if="!detalle.novedades?.length" class="muted">Sin novedades registradas</div><div v-for="n in detalle.novedades" :key="n.id" class="notice"><strong>{{n.tipo}}</strong> · {{n.descripcion}} <small>{{fecha(n.fecha_utc)}}</small></div></section></div>
</template>
