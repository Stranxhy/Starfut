@echo off
rem Inicia Starfutbol: base de datos (Docker) y la aplicacion en http://localhost:3000
rem Uso: doble clic en este archivo. Para detener la aplicacion, cierra esta ventana.
title Starfutbol
cd /d "%~dp0"

echo Verificando Docker...
docker info >nul 2>&1
if errorlevel 1 (
  echo Abriendo Docker Desktop, espera un momento...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  :esperar_docker
  timeout /t 3 /nobreak >nul
  docker info >nul 2>&1
  if errorlevel 1 goto esperar_docker
)

echo Iniciando la base de datos...
docker compose up -d db

if not exist ".next\BUILD_ID" (
  echo Preparando la aplicacion por primera vez, puede tardar unos minutos...
  call npm run build
)

echo.
echo Starfutbol se esta iniciando en http://localhost:3000
echo No cierres esta ventana mientras uses la aplicacion.
echo.
start "" cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"
call npm start
