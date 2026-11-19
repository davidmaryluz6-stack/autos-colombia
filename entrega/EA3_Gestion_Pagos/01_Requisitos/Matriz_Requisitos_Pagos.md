# Matriz de requisitos · Gestión de pagos (EA3)

## Funcionales

| ID | Descripción | Prioridad | Criterio de aceptación | Relación con el sistema existente |
|---|---|---|---|---|
| RF3-01 | Registrar el pago de una mensualidad indicando vehículo, periodo (AAAA-MM), valor, método y referencia. | Alta | Con datos válidos el sistema responde 201, guarda el pago con estado REGISTRADO y asigna el número de comprobante CP-nnnnnn. | Extiende el menú de la I2; usa vehiculos y clientes de I1/I2. |
| RF3-02 | Asociar cada pago a un vehículo y, por medio de este, a su cliente titular; solo clientes activos. | Alta | El pago guarda cliente_id y vehiculo_id; si el vehículo no existe responde 404 y si el cliente está inactivo responde 409. | Relaciones FK con vehiculos y clientes. |
| RF3-03 | Validar valor (> 0, máx. 2 decimales, tope configurable), periodo (formato y máx. 12 meses de anticipación), método y referencia (obligatoria si no es efectivo). | Alta | Entradas inválidas responden 400 con mensaje claro y no crean registros. | Se suma a validation.js de la I1/I2. |
| RF3-04 | Impedir duplicados: un pago activo por vehículo y periodo, y una referencia activa por método. | Alta | El segundo intento responde 409; si el pago previo está ANULADO el periodo puede registrarse de nuevo. | Reutiliza el patrón de restricciones UNIQUE de I1/I2. |
| RF3-05 | Consultar el historial de pagos con filtros por placa, periodo y estado. | Alta | La lista devuelve solo coincidencias, ordenada del más reciente al más antiguo; filtros inválidos responden 400. | Sigue el patrón del historial de movimientos (I1). |
| RF3-06 | Generar y consultar un comprobante interno del pago, numerado CP-nnnnnn (no es factura ni documento tributario). | Media | El comprobante muestra número, cliente, placa, periodo, valor, método, referencia, estado y responsable, y puede imprimirse sin el menú de la aplicación. | Nueva vista dentro del módulo de pagos. |
| RF3-07 | Consultar la cartera pendiente: vehículos autorizados de clientes activos sin pago registrado en los periodos evaluados. | Media | Al registrar un pago el vehículo sale de la cartera; al anularlo vuelve a aparecer. | Cruza vehiculos y clientes (I1/I2) con pagos. |
| RF3-08 | Anular un pago indicando motivo (solo ADMIN); no se elimina el registro. | Media | ADMIN anula con motivo de 5 a 255 caracteres; OPERADOR recibe 403; doble anulación responde 409. | Usa el control de roles de la I2. |
| RF3-09 | Controlar el acceso: ADMIN y OPERADOR registran y consultan; solo ADMIN anula. | Alta | Sin sesión 401; rol insuficiente 403; el menú muestra la acción «Anular» solo a ADMIN. | Reutiliza requiereSesion y requiereRol. |
| RF3-10 | Registrar en auditoría cada pago y cada anulación. | Media | Existe una fila REGISTRAR_PAGO o ANULAR_PAGO con usuario, fecha y detalles. | Usa la tabla auditoria existente. |

## No funcionales

| ID | Descripción | Prioridad | Criterio de aceptación | Relación con el sistema existente |
|---|---|---|---|---|
| RNF3-01 | Integridad: el registro del pago y su auditoría se ejecutan en una transacción con bloqueo del vehículo; los duplicados se bloquean también en la base de datos. | Alta | Una inserción directa duplicada falla por UNIQUE; un error revierte la transacción. | Mismo patrón transaccional de repository.js. |
| RNF3-02 | Seguridad: consultas parametrizadas, validación de entradas, sesión por cookie HttpOnly y rechazo de orígenes ajenos. | Alta | Entradas con inyección (p. ej. «1 OR 1=1») son rechazadas sin llegar a SQL. | Hereda helmet, sesión y control de origen de la I1. |
| RNF3-03 | Compatibilidad y reproducibilidad: migración 05 idempotente que no modifica datos previos. | Alta | La migración se ejecuta dos veces sin error y las 34 pruebas previas siguen aprobadas. | Scripts database/01 a 05. |
| RNF3-04 | Configurabilidad: ninguna tarifa, mora o descuento se define en el código; solo parámetros opcionales por variables de entorno. | Media | Sin configuración, valorMensualReferencia es nulo y el valor lo digita el operador. | backend/.env.example. |
| RNF3-05 | Usabilidad: interfaz coherente con la existente, mensajes en español y formato monetario COP. | Media | Las pantallas reutilizan estilos y patrones de las iteraciones 1 y 2. | frontend/App.vue y style.css. |
| RNF3-06 | Trazabilidad y calidad: pruebas automatizadas del módulo ejecutables con npm test. | Media | 20 pruebas nuevas aprobadas junto con las previas. | backend/tests/iteracion3.test.js. |
| RNF3-07 | Fechas almacenadas en UTC y mostradas en hora de Colombia. | Baja | La interfaz muestra la fecha de pago en America/Bogota. | Convención de la I1. |

## Trazabilidad

| Requisito | Historias | Casos de uso | Mockups | Pruebas relacionadas |
|---|---|---|---|---|
| RF3-01 | HU3-01 | CU3-01 | M1, M3 | PA-04, PE-01, PU-01 |
| RF3-02 | HU3-01 | CU3-01 | M1 | PA-06, PB-04, PP-06 |
| RF3-03 | HU3-01, HU3-03 | CU3-01 (incluye validar datos) | M1 | PA-01, PA-02, PA-03, PE-03, PB-03 |
| RF3-04 | HU3-02 | CU3-01 (incluye validar datos) | M1 | PA-05, PA-08, PE-02, PE-04, PB-01, PB-02, PU-02, PP-01 |
| RF3-05 | HU3-04 | CU3-02 | M2 | PA-09, PE-06, PU-03 |
| RF3-06 | HU3-05 | CU3-03 (extiende CU3-02) | M3 | PA-04, PE-06, PU-01, PP-04 |
| RF3-07 | HU3-06 | CU3-04 | M4 | PA-10, PE-05, PU-04, PP-02 |
| RF3-08 | HU3-07 | CU3-05 | M2 | PA-08, PE-07, PU-05 |
| RF3-09 | HU3-04, HU3-07 | Restricción transversal (todos) | M2 | PA-07, PE-07, PE-08, PU-03 |
| RF3-10 | HU3-01, HU3-07 | CU3-01 y CU3-05 (incluyen auditoría) | — | PA-04, PE-08 |
| RNF3-01 | — | CU3-01 | — | PB-01, PB-02, PP-01 |
| RNF3-02 | — | Todos | — | PA-06 (entrada con inyección) |
| RNF3-03 | — | — | — | PB-05, PA-11 |
| RNF3-04 | — | CU3-01 | M1 | PA-11, PP-03 |
| RNF3-05 | — | Todos | M1 a M4 | PU-01 a PU-05, PP-05a, PP-05b |
| RNF3-06 | — | — | — | PA-01 a PA-11 (npm test: 54 de 54) |
| RNF3-07 | — | CU3-03 | M3 | PU-01 (fecha de pago mostrada en hora de Colombia) |
