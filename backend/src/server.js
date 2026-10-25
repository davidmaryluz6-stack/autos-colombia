import 'dotenv/config';
import {app} from './app.js';
import {pool} from './db.js';
if(!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length<32 || process.env.SESSION_SECRET.startsWith('CAMBIAR')){
 console.error('Configura SESSION_SECRET con al menos 32 caracteres aleatorios en backend/.env');process.exit(1);
}
const port=Number(process.env.PORT||3000);
try {await pool.query('SELECT 1');console.log('MySQL conectado: autos_colombia');}
catch(e){console.error('No hay conexión MySQL:',e.message);process.exit(1);}
app.listen(port,()=>console.log(`API Autos Colombia → http://localhost:${port}`));
