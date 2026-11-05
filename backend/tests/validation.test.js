import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarPlaca,
  normalizarCelda,
  normalizarUsuario,
  normalizarDocumento,
  parseId,
  validarNovedad,
  validarFechas,
  validarVehiculo,
  compatibleConCelda,
  validarCuentaCrear,
  validarCuentaActualizar,
  validarCredenciales,
  validarClienteCrear,
  validarClienteActualizar,
  validarCeldaCrear,
  validarCeldaActualizar,
  validarCambioCeldaOcupada,
} from '../src/validation.js';

// Iteración 1
test('normaliza placa', () => assert.equal(normalizarPlaca(' abc123 '), 'ABC123'));
test('placa inválida', () => assert.throws(() => normalizarPlaca('ABC!')));
test('normaliza celda', () => assert.equal(normalizarCelda(' c-001 '), 'C-001'));
test('evita id inválido', () => assert.throws(() => parseId('0 OR 1=1')));
test('no acepta novedad vacía', () =>
  assert.throws(() => validarNovedad({movimientoId: 1, tipo: 'OBSERVACION', descripcion: ''})));
test('acepta novedad válida', () =>
  assert.equal(validarNovedad({movimientoId: 5, tipo: 'OBSERVACION', descripcion: 'Puerta verificada'}).id, '5'));
test('fechas en orden', () => assert.throws(() => validarFechas({desde: '2026-10-25', hasta: '2026-10-24'})));
test('celda mixta', () => assert.equal(compatibleConCelda('MOTOCICLETA', 'MIXTA'), true));
test('moto en celda automóvil denegada', () => assert.equal(compatibleConCelda('MOTOCICLETA', 'AUTOMOVIL'), false));
test('auto en celda moto denegado', () => assert.equal(compatibleConCelda('AUTOMOVIL', 'MOTOCICLETA'), false));
test('valida y normaliza un vehiculo nuevo', () =>
  assert.deepEqual(
    validarVehiculo({
      placa: ' abc123 ',
      tipo: 'automovil',
      color: ' Blanco ',
      clienteId: 2,
      autorizado: true,
      autorizacionHasta: '2027-12-31',
    }),
    {
      placa: 'ABC123',
      tipo: 'AUTOMOVIL',
      color: 'Blanco',
      clienteId: '2',
      autorizado: 1,
      autorizacionHasta: '2027-12-31',
    }
  ));
test('rechaza tipo de vehiculo incompatible con MySQL', () =>
  assert.throws(() =>
    validarVehiculo({
      placa: 'ABC123',
      tipo: 'BICICLETA',
      color: 'Rojo',
      clienteId: 2,
      autorizado: true,
      autorizacionHasta: '2027-12-31',
    })
  ));
test('rechaza fecha de vencimiento inexistente', () =>
  assert.throws(() =>
    validarVehiculo({
      placa: 'ABC123',
      tipo: 'AUTOMOVIL',
      color: 'Rojo',
      clienteId: 2,
      autorizado: true,
      autorizacionHasta: '2027-02-30',
    })
  ));
test('exige autorizacion booleana', () =>
  assert.throws(() =>
    validarVehiculo({
      placa: 'ABC123',
      tipo: 'AUTOMOVIL',
      color: 'Rojo',
      clienteId: 2,
      autorizado: 'true',
      autorizacionHasta: '2027-12-31',
    })
  ));

// Iteración 2 · Cuentas de acceso
test('normaliza usuario de acceso', () => assert.equal(normalizarUsuario('  MRodriguez_01 '), 'mrodriguez_01'));
test('rechaza usuario con caracteres inválidos', () => assert.throws(() => normalizarUsuario('admin con espacio')));
test('valida creación de cuenta', () =>
  assert.deepEqual(
    validarCuentaCrear({
      nombre: ' Mariana Rodríguez ',
      usuario: ' MRodriguez ',
      contrasena: 'PasswordSegura2026!',
      rol: 'operador',
      activo: true,
    }),
    {
      nombre: 'Mariana Rodríguez',
      usuario: 'mrodriguez',
      contrasena: 'PasswordSegura2026!',
      rol: 'OPERADOR',
      activo: 1,
    }
  ));
test('rechaza contraseña corta al crear cuenta', () =>
  assert.throws(() =>
    validarCuentaCrear({
      nombre: 'Usuario Prueba',
      usuario: 'uprueba',
      contrasena: '123',
      rol: 'OPERADOR',
    })
  ));
test('valida actualización parcial de cuenta', () =>
  assert.deepEqual(validarCuentaActualizar({rol: 'admin', activo: false}), {rol: 'ADMIN', activo: 0}));
test('valida restablecimiento de credenciales con confirmación', () =>
  assert.deepEqual(validarCredenciales({contrasena: 'NuevaClave2026!', confirmacion: 'NuevaClave2026!'}), {
    contrasena: 'NuevaClave2026!',
  }));
test('rechaza confirmación distinta en credenciales', () =>
  assert.throws(() => validarCredenciales({contrasena: 'NuevaClave2026!', confirmacion: 'OtraClave2026!'})));

// Iteración 2 · Clientes mensualistas
test('normaliza documento de cliente', () => assert.equal(normalizarDocumento(' doc-001 '), 'DOC-001'));
test('valida creación de cliente con contacto opcional', () =>
  assert.deepEqual(
    validarClienteCrear({
      nombre: ' Valentina Osorio ',
      documento: ' 1015346289 ',
      telefono: ' 300 452 9081 ',
      correo: ' Valentina@Ejemplo.com ',
      activo: true,
    }),
    {
      nombre: 'Valentina Osorio',
      documento: '1015346289',
      telefono: '300 452 9081',
      correo: 'valentina@ejemplo.com',
      activo: 1,
    }
  ));
test('rechaza correo inválido en cliente', () =>
  assert.throws(() =>
    validarClienteCrear({
      nombre: 'Valentina Osorio',
      documento: '1015346289',
      correo: 'correo-invalido',
    })
  ));
test('valida actualización de estado de cliente', () =>
  assert.deepEqual(validarClienteActualizar({activo: false}), {activo: 0}));

// Iteración 2 · Celdas y ocupación
test('valida creación de celda', () =>
  assert.deepEqual(validarCeldaCrear({codigo: ' qa-c01 ', tipo: 'mixta', habilitada: true}), {
    codigo: 'QA-C01',
    tipo: 'MIXTA',
    habilitada: 1,
  }));
test('rechaza tipo de celda inválido', () =>
  assert.throws(() => validarCeldaCrear({codigo: 'QA-C01', tipo: 'CAMION'})));
test('valida actualización de celda', () =>
  assert.deepEqual(validarCeldaActualizar({tipo: 'automovil', habilitada: false}), {
    tipo: 'AUTOMOVIL',
    habilitada: 0,
  }));
test('impide deshabilitar una celda ocupada (RF2-C05)', () =>
  assert.throws(
    () =>
      validarCambioCeldaOcupada(
        {
          codigo: 'C-001',
          tipo: 'MIXTA',
          habilitada: 1,
          estado_ocupacion: 'OCUPADA',
          movimiento_activo_id: 10,
          tipo_vehiculo_actual: 'AUTOMOVIL',
        },
        {habilitada: 0}
      ),
    /No se puede deshabilitar una celda con permanencia activa/
  ));
test('impide cambiar una celda ocupada a un tipo incompatible (RF2-C05 / RF2-C07)', () =>
  assert.throws(
    () =>
      validarCambioCeldaOcupada(
        {
          codigo: 'C-001',
          tipo: 'MIXTA',
          habilitada: 1,
          estado_ocupacion: 'OCUPADA',
          movimiento_activo_id: 10,
          tipo_vehiculo_actual: 'MOTOCICLETA',
        },
        {tipo: 'AUTOMOVIL'}
      ),
    /incompatible/
  ));
test('permite cambiar tipo o deshabilitar cuando la celda está libre', () =>
  assert.doesNotThrow(() =>
    validarCambioCeldaOcupada(
      {
        codigo: 'C-002',
        tipo: 'MIXTA',
        habilitada: 1,
        estado_ocupacion: 'DISPONIBLE',
        movimiento_activo_id: null,
      },
      {tipo: 'AUTOMOVIL', habilitada: 0}
    )
  ));
