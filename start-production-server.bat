@echo off
cd /d "%~dp0"
echo Iniciando Distrito Miami en modo estable: http://127.0.0.1:3000
echo.
echo Deja esta ventana abierta mientras revisas la tienda.
echo Para cerrar el servidor, presiona Ctrl+C.
echo.
npm run start
pause
