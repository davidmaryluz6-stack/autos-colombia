# Plan de pruebas · Punto 9

| Caso | Preparación | Acción | Resultado esperado |
|---|---|---|---|
| PF-01 | Cuenta local creada | Inicio de sesión correcto | Acceso al panel |
| PF-02 | Cuenta local creada | Contraseña incorrecta | 401 sin acceso |
| PF-03 | Vehículo autorizado y celda libre | Registrar entrada | MOV activo y celda ocupada |
| PF-04 | Vehículo ya activo | Repetir entrada | 409; sin segundo MOV |
| PF-05 | Celda ocupada | Ingresar otro vehículo en ella | 409; sin segundo ocupante |
| PF-06 | Vehículo con vigencia vencida | Intentar entrada | 409; sin MOV |
| PF-07 | MOV activo | Registrar novedad | Novedad asociada y auditable |
| PF-08 | MOV activo | Registrar salida | MOV finalizado, celda libre |
| PF-09 | MOV finalizado | Repetir salida | 409; sin cambios |
| PF-10 | Movimientos existentes | Filtrar historial por placa | Solo coincidencias |
| PF-11 | Usuario OPERADOR | Consultar auditoría | 403 |
| PF-12 | Usuario ADMIN | Consultar auditoría | Resultado limitado a 100 |
| PF-13 | Sesión activa y cliente activo | Registrar vehículo con placa nueva | Vehículo creado y opción Registrar entrada disponible |
| PF-14 | Placa ya registrada | Intentar registrar la misma placa | 409; sin vehículo duplicado |
| PF-15 | Cliente inexistente o inactivo | Intentar registrar vehículo | 400; sin cambios en la tabla `vehiculos` |
| PF-16 | Vehículo no autorizado o vencido recién registrado | Intentar continuar a Registrar entrada | Opción bloqueada; sin MOV |

## Estado de verificación

**Verificables automáticamente sin BD:** validación de placa, celda, fechas, datos del vehículo, tipos de novedad, compatibilidad e identificadores con `npm test`.

**Resultados comprobados:** `npm test`: 16 de 16 pruebas unitarias aprobadas; comprobación sintáctica de los archivos JavaScript del backend sin errores.

**Evidencias adicionales para la entrega:** conservar capturas de la aplicación funcionando, registro de un vehículo, entrada y salida y consultas SQL. Los casos de integración PF-01 a PF-16 no están acreditados en su totalidad solo por el resultado de las pruebas unitarias.

## Evidencias para incorporar al Word

- Captura de terminales mostrando frontend y backend en ejecución.
- Captura de pantalla de entrada registrada y tabla `movimientos`.
- Captura de salida registrada y recuperación de celda disponible.
- URL real del repositorio GitHub con código publicado.
