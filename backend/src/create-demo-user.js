import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {pool} from './db.js';
const username=process.env.DEMO_USERNAME;
const password=process.env.DEMO_PASSWORD;
if(!username||!password||password.startsWith('CAMBIAR')||password.length<8){
 console.error('Define DEMO_USERNAME y DEMO_PASSWORD (mínimo 8 caracteres) en .env');process.exit(1);
}
try{
 const hash=await bcrypt.hash(password,12);
 await pool.execute(`INSERT INTO usuarios(nombre,usuario,contrasena_hash,rol,activo)
 VALUES('Operador local',?,?,'OPERADOR',1)
 ON DUPLICATE KEY UPDATE contrasena_hash=VALUES(contrasena_hash),activo=1`,[username,hash]);
 console.log('Cuenta local configurada. Usuario:',username);
}catch(e){console.error('Error creando cuenta:',e.message);process.exitCode=1;}
finally{await pool.end();}
