# Historias de usuario · Gestión de pagos (EA3)

| ID | Rol | Necesidad (quiero…) | Beneficio (para…) | Criterios de aceptación | Prioridad | Requisitos |
|---|---|---|---|---|---|---|
| HU3-01 | Operador | Registrar el pago mensual de un vehículo | Dejar constancia de que el cliente está al día | 1) Selecciono vehículo, periodo, valor y método. 2) Al guardar veo el comprobante. 3) Si faltan datos o son inválidos veo un mensaje claro. | Alta | RF3-01, RF3-02, RF3-03 |
| HU3-02 | Operador | Que el sistema rechace pagos duplicados del mismo periodo | Evitar cobros repetidos | 1) No se permite un segundo pago activo del mismo vehículo y periodo. 2) La referencia repetida del mismo método se rechaza. | Alta | RF3-04 |
| HU3-03 | Operador | Registrar el método y la referencia del pago | Poder verificar el pago posteriormente | 1) Los pagos que no son en efectivo exigen referencia. 2) La referencia queda visible en el comprobante. | Media | RF3-03 |
| HU3-04 | Operador / Administrador | Consultar el historial de pagos con filtros | Resolver reclamaciones y verificar pagos | 1) Puedo filtrar por placa, periodo y estado. 2) Veo valor, método y estado de cada pago. | Alta | RF3-05 |
| HU3-05 | Operador / Administrador | Consultar el comprobante de un pago | Entregar o imprimir una constancia al cliente | 1) El comprobante muestra el número CP-nnnnnn y los datos del pago. 2) Indica que no es factura electrónica. | Media | RF3-06 |
| HU3-06 | Operador / Administrador | Consultar la cartera pendiente | Saber qué vehículos no han pagado el periodo | 1) Veo placa, cliente, documento y periodo pendiente. 2) Los pagos registrados retiran al vehículo de la lista. | Media | RF3-07 |
| HU3-07 | Administrador | Anular un pago registrado por error indicando el motivo | Corregir errores sin borrar la trazabilidad | 1) Solo ADMIN ve y ejecuta la anulación. 2) El motivo es obligatorio. 3) El pago anulado permanece en el historial y el periodo vuelve a estar pendiente. | Media | RF3-08, RF3-09, RF3-10 |
