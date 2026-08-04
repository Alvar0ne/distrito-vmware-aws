@echo off
if /I not "%~1"=="consola" (
  start "Distrito Miami - Servidor Local" cmd.exe /k ""%~f0" consola"
  exit /b
)

title Distrito Miami - Servidor Local
cd /d "%~dp0"
cls
echo ============================================================
echo  DISTRITO MIAMI - SERVIDOR LOCAL
echo ============================================================
echo.
echo  1. Deja esta ventana abierta.
echo  2. Abre la tienda en: http://127.0.0.1:3000
echo  3. Para cerrar el servidor, presiona Ctrl+C.
echo.
echo ============================================================
echo.
npm run start
echo.
echo ============================================================
echo  EL SERVIDOR SE DETUVO O NO PUDO INICIAR.
echo  Revisa el mensaje de error que aparece arriba.
echo ============================================================
echo.
