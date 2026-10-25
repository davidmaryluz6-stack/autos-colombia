import test from 'node:test';
import assert from 'node:assert/strict';
import {generarToken,verificarToken} from '../src/session.js';
process.env.SESSION_SECRET='clave_aleatoria_local_para_pruebas_de_sesion_segura_2026';
test('la sesión firmada se verifica',()=>{
 const token=generarToken({id:3,rol:'OPERADOR'});
 assert.equal(verificarToken(token).sub,'3');
});
test('sesión manipulada es rechazada',()=>{
 const token=generarToken({id:3,rol:'OPERADOR'});
 const [body,sig]=token.split('.');
 assert.equal(verificarToken(body+'a.'+sig),null);
});
