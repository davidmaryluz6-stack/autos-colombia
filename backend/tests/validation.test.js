import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizarPlaca,normalizarCelda,parseId,validarNovedad,validarFechas,validarVehiculo,compatibleConCelda} from '../src/validation.js';
test('normaliza placa',()=>assert.equal(normalizarPlaca(' abc123 '),'ABC123'));
test('placa inválida',()=>assert.throws(()=>normalizarPlaca('ABC!')));
test('normaliza celda',()=>assert.equal(normalizarCelda(' c-001 '),'C-001'));
test('evita id inválido',()=>assert.throws(()=>parseId('0 OR 1=1')));
test('no acepta novedad vacía',()=>assert.throws(()=>validarNovedad({movimientoId:1,tipo:'OBSERVACION',descripcion:''})));
test('acepta novedad válida',()=>assert.equal(validarNovedad({movimientoId:5,tipo:'OBSERVACION',descripcion:'Puerta verificada'}).id,'5'));
test('fechas en orden',()=>assert.throws(()=>validarFechas({desde:'2026-10-25',hasta:'2026-10-24'})));
test('celda mixta',()=>assert.equal(compatibleConCelda('MOTOCICLETA','MIXTA'),true));
test('moto en celda automóvil denegada',()=>assert.equal(compatibleConCelda('MOTOCICLETA','AUTOMOVIL'),false));
test('auto en celda moto denegado',()=>assert.equal(compatibleConCelda('AUTOMOVIL','MOTOCICLETA'),false));
test('valida y normaliza un vehiculo nuevo',()=>assert.deepEqual(
 validarVehiculo({placa:' abc123 ',tipo:'automovil',color:' Blanco ',clienteId:2,autorizado:true,autorizacionHasta:'2027-12-31'}),
 {placa:'ABC123',tipo:'AUTOMOVIL',color:'Blanco',clienteId:'2',autorizado:1,autorizacionHasta:'2027-12-31'}
));
test('rechaza tipo de vehiculo incompatible con MySQL',()=>assert.throws(()=>validarVehiculo(
 {placa:'ABC123',tipo:'BICICLETA',color:'Rojo',clienteId:2,autorizado:true,autorizacionHasta:'2027-12-31'}
)));
test('rechaza fecha de vencimiento inexistente',()=>assert.throws(()=>validarVehiculo(
 {placa:'ABC123',tipo:'AUTOMOVIL',color:'Rojo',clienteId:2,autorizado:true,autorizacionHasta:'2027-02-30'}
)));
test('exige autorizacion booleana',()=>assert.throws(()=>validarVehiculo(
 {placa:'ABC123',tipo:'AUTOMOVIL',color:'Rojo',clienteId:2,autorizado:'true',autorizacionHasta:'2027-12-31'}
)));
