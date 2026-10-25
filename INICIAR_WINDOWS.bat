@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Autos Colombia / Iteracion 1
where node >nul 2>&1 || (echo Instala Node.js primero. & pause & exit /b 1)
if not exist "backend\.env" (
  echo No se encontro backend\.env. Copia .env.example y configura MySQL y SESSION_SECRET.
  pause
  exit /b 1
)
start "Autos Colombia API" cmd /k "cd /d ""%~dp0backend"" && npm run dev"
start "Autos Colombia WEB" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"
echo Se abrieron dos terminales. Abre http://127.0.0.1:5173
pause
