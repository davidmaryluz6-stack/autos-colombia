# Autos Colombia · Iteración 1

Sistema académico para gestionar entrada y salida de vehículos de un parqueadero por mensualidad. **Vue 3 + Vite**, **Node.js + Express** y **MySQL 8**, compatible con el modelo físico del punto 5.

## Requisitos

- Node.js 20.19 o superior y npm.
- MySQL Server 8.0.16 o superior iniciado, con una conexión funcional en MySQL Workbench.
- MySQL Workbench para ejecutar los scripts y mostrar el modelo EER.

## Paso 1. Base de datos

En MySQL Workbench, sobre una base `autos_colombia` **vacía**, ejecuta en orden los archivos de la carpeta `database/` de este mismo repositorio:

1. `01_Modelo_Fisico_MySQL8_DDL.sql` (crea siete tablas).
2. `02_Vista_y_Procedimientos.sql` (crea vista y procedimientos). **Fundamental** para que funcione la aplicación.
3. `03_Datos_Ficticios_Demo.sql` (opcional, solo una vez, en una base vacía).

Si ya tienes tablas y datos, **no vuelvas a ejecutar el script de datos ficticios**. Puedes ejecutar el archivo 02 para garantizar la presencia de los procedimientos (emplea `DROP PROCEDURE IF EXISTS`).

## Paso 2. Servidor (API)

En PowerShell o terminal:

```powershell
cd backend
Copy-Item .env.example .env
npm install
```

Abre `.env` y configura **DB_PASSWORD** para tu MySQL y un **SESSION_SECRET** aleatorio de al menos 32 caracteres. Configura `DEMO_USERNAME` y `DEMO_PASSWORD` (contraseña local de 8+ caracteres); después:

```powershell
npm run demo:user
npm test
npm run dev
```

La API queda en http://localhost:3000; `http://localhost:3000/api/health` permite comprobar la conexión. La cuenta local se crea o actualiza con `npm run demo:user`; el hash se almacena con bcrypt. **Nunca subas el archivo `.env` al repositorio.**

## Paso 3. Frontend Vue

En **otra terminal**:

```powershell
cd frontend
npm install
npm run dev
```

Abre http://127.0.0.1:5173 y usa las credenciales de prueba que configuraste en `backend/.env`. El frontend proxy reenvía `/api` al servidor Express. Mantén las dos terminales abiertas.

**Nota técnica**: utiliza siempre `http://127.0.0.1:5173` en desarrollo, no `file://`. La aplicación hace consultas al backend MySQL, no almacena entradas simuladas en el navegador.

## Funciones

- Iniciar y cerrar sesión con cookies HttpOnly y límite de intentos.
- Registrar vehículos para clientes existentes y activos, con placa única, autorización y vencimiento.
- Consultar vehículos autorizados y celda compatible disponible.
- Registrar entrada mediante `sp_registrar_entrada`; bloquea duplicados y ocupa una celda.
- Consultar vehículos presentes e indicadores actualizados.
- Registrar salida mediante `sp_registrar_salida`; libera la celda.
- Consultar historial por placa, fecha y estado.
- Registrar novedades asociadas a un movimiento activo con `sp_registrar_novedad`.
- Ver detalle y trazabilidad; consultar auditoría como ADMIN.

## Estructura

- `backend/src/app.js`: rutas HTTP y control de permisos.
- `backend/src/repository.js`: consultas SQL parametrizadas.
- `backend/src/validation.js`: validaciones del dominio.
- `backend/src/session.js`: cookies y sesión firmada.
- `backend/tests`: pruebas unitarias que no requieren MySQL.
- `frontend/src/App.vue`: interfaz del usuario.
- `frontend/src/style.css`: diseño adaptativo.


Los datos mostrados dependen de la base real. Las contraseñas del `.env` son exclusivamente locales.


## Alcance académico y seguridad

No se procesan pagos ni se administran altas de clientes o celdas en esta iteración. El alta de vehículos es una ampliación controlada y conserva las validaciones de autorización y mensualidad antes de permitir una entrada. No es software validado para un parqueadero real: requiere pruebas de integración, HTTPS, registro centralizado y controles adicionales antes de usarse en producción.
