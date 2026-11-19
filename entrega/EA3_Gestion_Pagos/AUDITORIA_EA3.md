# Auditoría académica final · EA3 · Autos Colombia (Iteración 3: gestión de pagos)

Estudiante: Mariluz David Martínez · IU Digital de Antioquia · Auditoría realizada el 19 de noviembre de 2026 sobre los archivos locales. Los porcentajes son una estimación técnica, **no una calificación docente**.

## 1. Matriz de auditoría frente a los ocho requisitos de Canvas

| # | Requisito de Canvas | Archivo que lo demuestra | Página del PDF | Evidencia real | Estado | Corrección requerida |
|---|---|---|---|---|---|---|
| 1 | Requisitos funcionales y no funcionales de pagos | `01_Requisitos/Matriz_Requisitos_Pagos.md` | 4 a 7 (secc. 3) | 10 RF y 7 RNF con prioridad, criterio de aceptación y relación con el sistema; matriz de trazabilidad (p. 6-7) | Cumple | Ninguna |
| 2 | Diagramas de casos de uso en **StarUML** | `diagramas/01_casos_de_uso_pagos.svg` y `.png` | 8 y 9 (secc. 4) | Diagrama UML revisado (herencia ADMIN→OPERADOR, include, extend, restricción transversal). **No es un archivo de StarUML** | Cumple parcialmente | Recrearlo en StarUML y entregar el `.mdj` abierto y verificado |
| 3 | Historias de usuario de pagos | `02_Historias_Usuario/Historias_Usuario_Pagos.md` | 10 (secc. 5) | HU3-01 a HU3-07 con rol, necesidad, beneficio, criterios verificables, prioridad y requisitos | Cumple | Ninguna |
| 4 | Mockups en Figma u otra herramienta | `mockups/M1` a `M4` (`.html` editable y `.png`) | 11 a 15 (secc. 6) | 4 pantallas ligadas a HU y casos de uso; capturas reales aparte (p. 30-38) | Cumple | Ninguna (la herramienta es HTML/CSS, permitida como «otra herramienta») |
| 5 | Diagrama de secuencia con las tres iteraciones en **StarUML** | `diagramas/02_secuencia_integrada_I1_I2_I3.svg` y partes `02a` a `02e` | 16 a 21 (secc. 7) | 44 mensajes con rutas reales de Express, respuestas por la API, fragmentos `alt` | Cumple parcialmente | Recrearlo en StarUML |
| 6 | Diagrama de componentes con las tres iteraciones en **StarUML** | `diagramas/03_componentes_arquitectura_global.svg` y `.png` | 22 y 23 (secc. 8) | Solo componentes existentes en el código; FKs de `pagos` | Cumple parcialmente | Recrearlo en StarUML |
| 7 | Plan de pruebas resumido | `03_Plan_Pruebas/Plan_Pruebas_Pagos.md` | 24 a 28 (secc. 9) | Tablas con ID, requisito, escenario, entrada, procedimiento, esperado, observado y estado; ejecutadas, complementarias y pendientes separadas; `evidencias/resultado_npm_test.txt` (54 de 54) | Cumple | Ninguna |
| 8 | URL del repositorio de GitHub | Sección del PDF | 39 (secc. 11) | URL principal y de la rama de trabajo | Cumple en el documento | El usuario debe comprobar que `main` contiene el código (comandos en la sección 6) |

Estructura del informe: portada (p. 1), introducción con tabla de las ocho exigencias (p. 2), desarrollo (p. 3-38), conclusiones y limitaciones (p. 39).

## 2. Estimación de cumplimiento (no es calificación)

Con 1 punto por requisito cumplido y 0,5 por cumplimiento parcial: (5 × 1 + 3 × 0,5) / 8 = **81 %**. Los tres requisitos parciales dependen únicamente de StarUML; si se entregan los modelos nativos verificados, la estimación subiría a cerca del 100 %. El peso real lo decide el docente.

## 3. StarUML (principal pendiente)

- StarUML **no está instalado** (rutas habituales, registro de Windows y PATH).
- Sí está disponible por la vía oficial: `winget search staruml` devuelve `MKLabs.StarUML` 7.0.0. La instalación desde esta sesión fue bloqueada por los permisos, por lo que **no se instaló**.
- No se crearon archivos `.mdj` porque no se pueden abrir ni verificar sin la aplicación; un `.mdj` no verificado sería una afirmación falsa.
- Para desbloquearlo: instalar StarUML (comando en el informe ejecutivo), y entonces se pueden generar los modelos y comprobar que abran. Los SVG/PNG se conservan como respaldo.

## 4. Mediciones objetivas del PDF (39 páginas)

- Papel carta; 4 páginas verticales (portada, introducción y cierre: p. 1-3 y 39) y 35 horizontales (matrices, diagramas, mockups, pruebas y evidencias).
- Texto general: Times New Roman 12. Tablas: 10 a 11 pt. Numeración desde la página 2 (la portada no lleva número).
- Márgenes de texto a 72 pt (2,54 cm), con desviaciones de 3 pt de bordes de tabla.
- Texto de los diagramas: equivale a 8-9 pt impresos (7,7 pt en el de componentes): legible, pero pequeño.
- Metadatos del PDF: título y autor establecidos en esta auditoría.

## 5. Errores encontrados y corregidos en esta auditoría

1. Metadatos del PDF vacíos (título y autor): corregidos.
2. Sección 11 con una frase de proceso («la publicación la realiza la estudiante…») ya obsoleta: reescrita sin afirmar el estado de `main`.
3. La introducción no indicaba dónde estaba cada una de las ocho exigencias: se añadió la tabla de la página 2.
4. `INSTRUCCIONES_ENTREGA.md` no explicaba el archivo `PP-04_PP-05_resultado_DESPUES.txt`: se añadió la nota.

## 6. Coherencia técnica verificada contra el código

- Rutas de la API (`app.js`): `/api/pagos`, `/cartera`, `/config`, `/:id`, `/:id/comprobante`, `/:id/anular`; permisos ADMIN/OPERADOR para registrar y consultar y solo ADMIN para anular.
- Tabla `pagos` y restricciones UNIQUE, CHECK y FK: coinciden con `database/05_Migracion_Iteracion3_Pagos.sql`.
- Interfaz: la acción «Anular» solo se muestra al ADMIN; el comprobante ofrece «Imprimir»; la cartera, el historial y el formulario coinciden con las capturas.
- Integración: pagos referencia `usuarios`, `clientes` y `vehiculos`; no referencia `celdas` ni `movimientos` (indirecto por vehículo) y escribe en `auditoria`. El pago no condiciona la entrada ni la vigencia: así se documenta.
- Registro de mensualidades, rechazo de duplicados, historial, comprobante interno, cartera pendiente, anulación por ADMIN y auditoría: todos documentados con prueba ejecutada asociada.

## 7. Pruebas: ejecutadas y pendientes

- Ejecutadas: 54 de 54 (`npm test`), 8 de API con MySQL (PE), 5 de restricciones SQL (PB), 5 de interfaz (PU), PP-01 a PP-06 con evidencia en `evidencias/complementarias/`.
- Resultados con observaciones: PP-04 falló en la primera corrida y se corrigió; PP-05b aprobada con observaciones menores; PP-05a aprobada solo en parte.
- Pendientes (no ejecutadas): PP-03b, PP-04b, PP-05c y PP-07.
- Las pruebas `PA` usan un repositorio en memoria; la verificación con MySQL real fue manual y documentada.
- En esta auditoría no se ejecutó ninguna prueba nueva ni se modificó ningún dato.

## 8. Limitaciones que aún pueden afectar la nota

1. Los tres diagramas UML no son archivos nativos de StarUML (requisitos 2, 5 y 6).
2. Los mockups están en HTML, no en Figma (aceptable como «otra herramienta», a criterio del docente).
3. Pruebas pendientes (sección 7) y observaciones del diseño móvil.
4. El estado de `main` y del Pull Request #3 no se comprobó desde esta sesión.
