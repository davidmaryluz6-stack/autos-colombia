# Entrega EA3 · Gestión de pagos · Autos Colombia

Estudiante: Mariluz David Martínez · IU Digital de Antioquia.

## Qué subir a la plataforma
- `Martinez_Mariluz_EA3.pdf` (documento final, 39 páginas).
- Opcional: `Martinez_Mariluz_EA3.docx` (editable).
- URL del repositorio: https://github.com/davidmaryluz6-stack/autos-colombia (rama de trabajo `iteracion-3`: https://github.com/davidmaryluz6-stack/autos-colombia/tree/iteracion-3).

## Contenido de la carpeta
| Ruta | Contenido |
|---|---|
| `Martinez_Mariluz_EA3.pdf` / `.docx` | Informe académico (Times New Roman 12, interlineado 1,5, márgenes 2,54 cm, papel carta; tablas y diagramas en páginas horizontales) |
| `01_Requisitos/` | Matriz de requisitos funcionales y no funcionales con trazabilidad |
| `02_Historias_Usuario/` | Historias de usuario HU3-01 a HU3-07 |
| `03_Plan_Pruebas/` | Plan resumido: ejecutadas, complementarias ejecutadas y pendientes |
| `diagramas/` | Casos de uso, secuencia integrada (completa y en 5 partes) y componentes, en SVG editable y PNG. No son archivos nativos de StarUML (no está instalado) |
| `mockups/` | Mockups M1 a M4 (HTML editable y PNG); son prototipos, no capturas reales |
| `evidencias/` | Capturas reales, salida de `npm test`, prueba de la API contra MySQL, prueba de restricciones SQL y `complementarias/` con PP-01 a PP-06 |

## Reproducir las pruebas
1. `cd backend && npm install && npm test` (no requiere MySQL; 54 pruebas).
2. Para probar con MySQL 8: ejecutar `database/01`, `02`, `03` y `05`, copiar `backend/.env.example` a `backend/.env`, completar los valores locales y arrancar `npm run dev`. No subir nunca el archivo `.env`.
3. Parámetros opcionales de pagos (sin tarifas definidas por el sistema): `PAGO_VALOR_MAXIMO`, `PAGO_VALOR_MENSUAL`, `PAGO_MESES_CARTERA`.
