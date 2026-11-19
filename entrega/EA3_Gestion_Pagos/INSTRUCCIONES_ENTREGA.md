# Entrega EA3 · Gestión de pagos · Autos Colombia

Estudiante: Mariluz David Martínez · IU Digital de Antioquia.

## Qué subir a la plataforma
- `Martinez_Mariluz_EA3.pdf` (documento final). Nota: se usa EA3 aunque la plantilla indique EA1.
- Opcional: `Martinez_Mariluz_EA3.docx` (editable).
- URL del repositorio: https://github.com/davidmaryluz6-stack/autos-colombia (rama `iteracion-3`).

## Contenido de la carpeta
| Ruta | Contenido |
|---|---|
| `Martinez_Mariluz_EA3.pdf` / `.docx` | Informe académico |
| `01_Requisitos/` | Matriz de requisitos funcionales y no funcionales |
| `02_Historias_Usuario/` | Historias de usuario HU3-01 a HU3-07 |
| `03_Plan_Pruebas/` | Plan resumido (ejecutadas vs. propuestas) |
| `diagramas/` | Casos de uso, secuencia integrada y componentes (SVG editable + PNG). No son archivos nativos de StarUML |
| `mockups/` | Mockups M1 a M4 (HTML editable + PNG) |
| `evidencias/` | Capturas reales, salida de `npm test`, prueba de la API contra MySQL y prueba de restricciones SQL |

## Reproducir las pruebas
1. `cd backend && npm install && npm test` (no requiere MySQL; 54 pruebas).
2. Para probar con MySQL 8: ejecutar `database/01`, `02`, `03` y `05`, configurar `backend/.env` y arrancar `npm run dev`.
