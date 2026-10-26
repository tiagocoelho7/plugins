@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Instalar-visual.ps1"
set "GNB_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %GNB_EXIT%
