# Entrega EA3 · Gestión de pagos · Autos Colombia

Estudiante: Mariluz David Martínez · IU Digital de Antioquia.

## Qué subir a Canvas
- **PDF (obligatorio):** `entrega/EA3_Gestion_Pagos/Martinez_Mariluz_EA3.pdf` (39 páginas).
- **DOCX editable (opcional):** `entrega/EA3_Gestion_Pagos/Martinez_Mariluz_EA3.docx`.
- **URL del repositorio:** https://github.com/davidmaryluz6-stack/autos-colombia

## Contenido de la carpeta
| Ruta | Contenido |
|---|---|
| `Martinez_Mariluz_EA3.pdf` / `.docx` | Informe académico (Times New Roman 12, interlineado 1,5, márgenes 2,54 cm, papel carta; tablas y diagramas en páginas horizontales) |
| `AUDITORIA_EA3.md` | Matriz de auditoría contra los ocho requisitos de Canvas, con páginas del PDF y limitaciones |
| `01_Requisitos/` | Matriz de requisitos funcionales y no funcionales con trazabilidad |
| `02_Historias_Usuario/` | Historias de usuario HU3-01 a HU3-07 |
| `03_Plan_Pruebas/` | Plan resumido: ejecutadas, complementarias ejecutadas y pendientes |
| `diagramas/` | Casos de uso, secuencia integrada (completa y en 5 partes) y componentes, en SVG editable y PNG. **No son archivos nativos de StarUML** (no está instalado) |
| `mockups/` | Mockups M1 a M4 (HTML editable y PNG); son prototipos, no capturas reales |
| `evidencias/` | Capturas reales, salida de `npm test`, prueba de la API contra MySQL, prueba de restricciones SQL y `complementarias/` con PP-01 a PP-06 |

## Nota sobre las evidencias complementarias
`evidencias/complementarias/PP-04_PP-05_resultado_DESPUES.txt` repite la prueba de teclado después de la corrección de impresión; como el pago CP-000007 ya existía, muestra el rechazo por duplicado. El resultado válido de la prueba de teclado (pago registrado) es el de `PP-04_PP-05_resultado_ANTES.txt`, que es el que cita el informe.

## Limitaciones conocidas
- Los modelos UML no son archivos de StarUML (requisitos 2, 5 y 6 de Canvas); se conservan SVG y PNG.
- Los mockups están en HTML/CSS, no en Figma.
- Pruebas pendientes: PP-03b, PP-04b, PP-05c y PP-07.

## Reproducir las pruebas
1. `cd backend && npm install && npm test` (no requiere MySQL; 54 pruebas).
2. Para probar con MySQL 8: ejecutar `database/01`, `02`, `03` y `05`, copiar `backend/.env.example` a `backend/.env`, completar los valores locales y arrancar `npm run dev`. No subir nunca el archivo `.env`.
3. Parámetros opcionales de pagos (el sistema no define tarifas): `PAGO_VALOR_MAXIMO`, `PAGO_VALOR_MENSUAL`, `PAGO_MESES_CARTERA`.
