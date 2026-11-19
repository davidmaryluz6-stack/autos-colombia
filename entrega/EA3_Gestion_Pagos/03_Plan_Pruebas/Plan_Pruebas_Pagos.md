# Plan resumido de pruebas · Gestión de pagos (EA3)

Resultado global de `npm test`: 54 pruebas, 54 aprobadas (34 previas + 20 nuevas). Las filas «Propuesta» NO se ejecutaron.

## Ejecutadas

| ID | Req. | Escenario y datos de entrada | Procedimiento | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|---|---|
| PA-01 | RF3-03 | Valor inválido: 0, -5, «abc», «1e5», «10.999», superior al tope. | npm test (CP3-01, CP3-02). | Se rechaza con error de validación. | Todos rechazados. | Aprobada |
| PA-02 | RF3-03 | Periodo inválido («2026-13», «26-11», vacío, 1999) y a más de 12 meses. | npm test (CP3-03, CP3-04). | Rechazo; «2026-11» normaliza a 2026-11-01. | Rechazados y normalizado. | Aprobada |
| PA-03 | RF3-03 | Transferencia sin referencia; método «BITCOIN»; referencia con comillas. | npm test (CP3-05 a CP3-07). | Error de validación en los tres casos. | Errores esperados. | Aprobada |
| PA-04 | RF3-01, RF3-06, RF3-10 | Operador registra pago válido y consulta su comprobante. | npm test (CP3-11). | 201, CP-000001, comprobante informativo, auditoría REGISTRAR_PAGO. | Cumplido. | Aprobada |
| PA-05 | RF3-04 | Mismo vehículo y periodo dos veces; referencia repetida. | npm test (CP3-12, CP3-13). | 409 en el segundo intento. | 409 en ambos. | Aprobada |
| PA-06 | RF3-02 | Vehículo inexistente, cliente inactivo, id «1 OR 1=1». | npm test (CP3-14). | 404, 409 y 400. | Cumplido. | Aprobada |
| PA-07 | RF3-09 | Sin sesión; OPERADOR intenta anular. | npm test (CP3-15, CP3-16). | 401 y 403. | Cumplido. | Aprobada |
| PA-08 | RF3-08, RF3-04 | ADMIN anula; segunda anulación; id inexistente; nuevo pago del periodo anulado. | npm test (CP3-16, CP3-17). | 200, 409, 404 y 201. | Cumplido. | Aprobada |
| PA-09 | RF3-05 | Historial por placa, estado y filtros inválidos. | npm test (CP3-18). | Resultados filtrados; 400 con filtro inválido. | Cumplido. | Aprobada |
| PA-10 | RF3-07 | Cartera sin pagos, con pago y con pago anulado. | npm test (CP3-19). | Excluye clientes inactivos; baja al pagar y vuelve al anular. | Cumplido. | Aprobada |
| PA-11 | RNF3-04, RNF3-03 | Sin variables de entorno; rutas de I1/I2 y 34 pruebas previas. | npm test (CP3-09, CP3-10, CP3-20). | Sin tarifa inventada; permisos previos intactos. | 54 de 54 pruebas aprobadas. | Aprobada |
| PE-01 | RF3-01 | API real + MySQL 8: pago en efectivo del vehículo ABC123. | curl con sesión de operador. | 201 y comprobante. | 201 · CP-000001. | Aprobada |
| PE-02 | RF3-04 | API real: repetir el pago anterior. | curl. | 409. | 409 «Ya existe un pago…». | Aprobada |
| PE-03 | RF3-03 | API real: transferencia sin referencia y con valor -5. | curl. | 400. | 400 en ambos. | Aprobada |
| PE-04 | RF3-01, RF3-04 | API real: transferencia TR-9001; después misma referencia en otro vehículo. | curl. | 201 y luego 409. | 201 y 409. | Aprobada |
| PE-05 | RF3-07 | API real: cartera del periodo. | curl GET /api/pagos/cartera. | Solo vehículos sin pago. | 2 pendientes (EXP111, FRT905). | Aprobada |
| PE-06 | RF3-05, RF3-06 | API real: historial por placa y comprobante. | curl. | 200 con datos correctos. | 200. | Aprobada |
| PE-07 | RF3-08, RF3-09 | API real: OPERADOR anula; ADMIN anula; se vuelve a pagar el periodo. | curl. | 403, 200 y 201. | 403, 200 y 201. | Aprobada |
| PE-08 | RF3-10, RF3-09 | API real: auditoría de pagos y petición sin sesión. | curl. | Filas REGISTRAR/ANULAR_PAGO; 401. | Cumplido. | Aprobada |
| PB-01 | RNF3-01, RF3-04 | MySQL: INSERT directo con vehículo+periodo activo repetido. | mysql (evidencias/prueba_restricciones_mysql.txt). | Error UNIQUE. | ERROR 1062 uq_pagos_periodo_activo. | Aprobada |
| PB-02 | RNF3-01, RF3-04 | MySQL: INSERT directo con referencia activa repetida. | mysql. | Error UNIQUE. | ERROR 1062 uq_pagos_referencia_activa. | Aprobada |
| PB-03 | RF3-03 | MySQL: valor 0 y periodo con día 15. | mysql. | Error CHECK. | ERROR 3819 en ambos. | Aprobada |
| PB-04 | RF3-02 | MySQL: vehículo inexistente. | mysql. | Error FK. | ERROR 1452. | Aprobada |
| PB-05 | RNF3-03 | MySQL: ejecutar la migración 05 dos veces. | mysql < 05_Migracion_Iteracion3_Pagos.sql. | Sin errores. | Sin errores. | Aprobada |
| PU-01 | RF3-01, RF3-06 | Interfaz real: OPERADOR registra FRT905, TARJETA, VOUCHER-7788, 120000. | Navegador automatizado (Edge). | Aviso de éxito y comprobante. | CP-000003 mostrado. | Aprobada |
| PU-02 | RF3-04 | Interfaz real: repetir el mismo vehículo y periodo. | Navegador. | Mensaje de duplicado. | Mensaje mostrado. | Aprobada |
| PU-03 | RF3-05, RF3-09 | Interfaz real: historial como OPERADOR. | Navegador. | Sin acción «Anular». | Aviso «Solo ADMIN puede anular». | Aprobada |
| PU-04 | RF3-07 | Interfaz real: cartera tras los pagos. | Navegador. | Solo EXP111 pendiente. | Cumplido. | Aprobada |
| PU-05 | RF3-08 | Interfaz real: ADMIN anula con motivo. | Navegador. | Pago pasa a ANULADO. | Cumplido. | Aprobada |

## Propuestas (no ejecutadas)

| ID | Req. | Escenario y datos de entrada | Procedimiento | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|---|---|
| PP-01 | RNF3-01 | Dos registros simultáneos del mismo vehículo y periodo. | Script concurrente contra MySQL. | Solo uno se guarda. | No ejecutada. | Propuesta |
| PP-02 | RF3-07 | Cartera con PAGO_MESES_CARTERA=3. | Configurar variable y consultar. | Tres periodos evaluados. | No ejecutada. | Propuesta |
| PP-03 | RNF3-04 | PAGO_VALOR_MAXIMO bajo y PAGO_VALOR_MENSUAL definido. | Configurar y registrar. | Rechazo por tope; valor sugerido en el formulario. | No ejecutada. | Propuesta |
| PP-04 | RF3-06 | Imprimir comprobante en papel o PDF. | Botón Imprimir. | Formato legible. | No ejecutada. | Propuesta |
| PP-05 | RNF3-05 | Navegación por teclado y pantalla móvil. | Revisión manual. | Formulario usable. | No ejecutada. | Propuesta |
| PP-06 | RF3-02 | Desactivar un cliente que tiene pagos. | Interfaz de clientes. | El historial se conserva. | No ejecutada. | Propuesta |
