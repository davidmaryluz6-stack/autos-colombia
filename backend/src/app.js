import express from 'express';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import {pool} from './db.js';
import * as repo from './repository.js';
import {cookieOptions,extraerCookie,generarToken,verificarToken} from './session.js';
import {UserError,ESTADOS,normalizarPlaca,normalizarCelda,parseId,validarFechas,validarNovedad,validarVehiculo,compatibleConCelda} from './validation.js';

export const app=express();
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'24kb'}));
// La interfaz usa proxy Vite para el mismo origen. Rechazar cambios desde orígenes ajenos.
app.use('/api',(req,res,next)=>{
 if (['POST','PUT','PATCH','DELETE'].includes(req.method)) {
   const origin=req.get('origin');
   const host=req.get('host');
   if(origin){ try {if(new URL(origin).host!==host) return res.status(403).json({error:'Origen no autorizado'});} catch{return res.status(403).json({error:'Origen inválido'});} }
 }
 next();
});

const intentos=new Map();
app.get('/api/health',async(_req,res,next)=>{try{await pool.query('SELECT 1');res.json({ok:true,db:'conectada'});}catch(e){next(e);}});
app.post('/api/auth/login',async(req,res,next)=>{try {
 const usuario=String(req.body.usuario||'').trim(); const contrasena=String(req.body.contrasena||'');
 if(!usuario || usuario.length>60 || !contrasena) throw new UserError('Usuario y contraseña obligatorios');
 const key=req.ip||'local'; const hit=intentos.get(key)||{n:0,until:0};
 if(hit.until>Date.now()) throw new UserError('Demasiados intentos; prueba después.',429);
 const user=await repo.obtenerUsuario(usuario);
 const valid=user?.activo===1 && await bcrypt.compare(contrasena,user.contrasena_hash);
 if(!valid){hit.n++;if(hit.n>=6){hit.until=Date.now()+10*60*1000;hit.n=0;}intentos.set(key,hit);throw new UserError('Credenciales incorrectas',401);}
 intentos.delete(key);
 res.cookie('autos_session',generarToken(user),cookieOptions);
 res.json({usuario:{id:user.id,nombre:user.nombre,usuario:user.usuario,rol:user.rol}});
 } catch(e){next(e);} });

app.post('/api/auth/logout',(_req,res)=>{res.clearCookie('autos_session',{...cookieOptions,maxAge:undefined});res.json({ok:true});});
async function requiereSesion(req,_res,next){try {
 const payload=verificarToken(extraerCookie(req));
 if(!payload) throw new UserError('La sesión expiró. Ingresa nuevamente.',401);
 const user=await repo.usuarioActivo(payload.sub);
 if(!user) throw new UserError('Acceso no autorizado.',401);
 req.user=user;next();
}catch(e){next(e);}}
app.use('/api',requiereSesion);
const requiereRol=(...roles)=>(req,_res,next)=>{
 try {
   if(!roles.includes(req.user.rol))throw new UserError('No tienes permiso para realizar esta operación.',403);
   next();
 } catch(e){next(e);}
};
app.get('/api/auth/me',(req,res)=>res.json({usuario:req.user}));
app.get('/api/dashboard',async(_req,res,next)=>{try{res.json(await repo.consultarPanel());}catch(e){next(e);}});
app.get('/api/clientes',requiereRol('ADMIN','OPERADOR'),async(_req,res,next)=>{try{
 res.json(await repo.listarClientes());
}catch(e){next(e);}});
app.get('/api/vehiculos',async(req,res,next)=>{try{
 const placa=req.query.placa ? String(req.query.placa).toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,10):'';
 res.json(await repo.consultarVehiculos(placa));
}catch(e){next(e);}});
app.post('/api/vehiculos',requiereRol('ADMIN','OPERADOR'),async(req,res,next)=>{try{
 const datos=validarVehiculo(req.body);
 const vehiculo=await repo.registrarVehiculo({...datos,usuarioId:req.user.id});
 res.status(201).json({ok:true,mensaje:'Vehículo registrado correctamente',vehiculo});
}catch(e){next(e);}});
app.get('/api/celdas',async(req,res,next)=>{try{
 const tipo=req.query.tipo?String(req.query.tipo):'';
 const rows=await repo.consultarCeldas(tipo);
 res.json(req.query.disponibles==='1'?rows.filter(x=>x.estado_ocupacion==='DISPONIBLE'):rows);
}catch(e){next(e);}});
app.get('/api/movimientos',async(req,res,next)=>{try{
 const estado=String(req.query.estado||'').toUpperCase();
 if(estado && !ESTADOS.has(estado))throw new UserError('Estado desconocido');
 const placa=String(req.query.placa||'').toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,10);
 const fechas=validarFechas({desde:req.query.desde?String(req.query.desde):'',hasta:req.query.hasta?String(req.query.hasta):''});
 res.json(await repo.listarMovimientos({estado,placa,...fechas}));
}catch(e){next(e);}});
app.get('/api/movimientos/:id',async(req,res,next)=>{try{
 const info=await repo.detalleMovimiento(parseId(req.params.id));
 if(!info)throw new UserError('Movimiento no encontrado',404);
 res.json(info);
}catch(e){next(e);}});
app.post('/api/movimientos/entrada',async(req,res,next)=>{try{
 const placa=normalizarPlaca(req.body.placa), celda=normalizarCelda(req.body.codigoCelda);
 const vehiculos=await repo.consultarVehiculos(placa);
 const vehiculo=vehiculos.find(v=>v.placa===placa);
 const celdas=await repo.consultarCeldas();
 const espacio=celdas.find(c=>c.codigo===celda);
 if(vehiculo && espacio && !compatibleConCelda(vehiculo.tipo,espacio.tipo))throw new UserError('La celda no admite ese tipo de vehículo.');
 const id=await repo.registrarEntrada(placa,celda,req.user.id);
 res.status(201).json({ok:true,id,mensaje:'Entrada registrada correctamente'});
}catch(e){next(e);}});
app.post('/api/movimientos/:id/salida',async(req,res,next)=>{try{
 const id=parseId(req.params.id);
 await repo.registrarSalida(id,req.user.id);
 res.json({ok:true,id,mensaje:'Salida registrada y celda liberada'});
}catch(e){next(e);}});
app.get('/api/novedades',async(_req,res,next)=>{try{res.json(await repo.listarNovedades());}catch(e){next(e);}});
app.post('/api/novedades',async(req,res,next)=>{try{
 const data=validarNovedad(req.body);
 await repo.registrarNovedad({...data,usuarioId:req.user.id});
 res.status(201).json({ok:true,mensaje:'Novedad registrada'});
}catch(e){next(e);}});
app.get('/api/auditoria',async(req,res,next)=>{try{
 if(req.user.rol!=='ADMIN')throw new UserError('Solo administradores',403);
 res.json(await repo.listarAuditoria());
}catch(e){next(e);}});
app.use('/api',(req,res)=>res.status(404).json({error:'Ruta no encontrada'}));
app.use((err,_req,res,_next)=>{
 if(err instanceof UserError) return res.status(err.status).json({error:err.message});
 if(err?.code==='ER_DUP_ENTRY' && String(err.sqlMessage||err.message).includes('uq_vehiculos_placa')){
   return res.status(409).json({error:'La placa ya está registrada.'});
 }
 if(err?.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Ya existe una entrada o celda activa. Actualiza la lista.'});
 if(err?.sqlState==='45000'||err?.errno===1644) return res.status(409).json({error:err.sqlMessage||'Operación rechazada por las reglas del parqueadero'});
 if(err?.type==='entity.too.large')return res.status(413).json({error:'Solicitud demasiado grande'});
 console.error('Error interno API:',err);
 res.status(500).json({error:'No fue posible completar la operación. Comprueba la conexión y los procedimientos SQL.'});
});
