@echo off
chcp 65001 >nul
cd /d "%~dp0"

set ELECTRON_CMD=

if exist "%~dp0node_modules\.bin\electron.cmd" set "ELECTRON_CMD=%~dp0node_modules\.bin\electron.cmd"
if not defined ELECTRON_CMD if exist "%~dp0..\node_modules\.bin\electron.cmd" set "ELECTRON_CMD=%~dp0..\node_modules\.bin\electron.cmd"
if not defined ELECTRON_CMD if exist "%~dp0..\..\node_modules\.bin\electron.cmd" set "ELECTRON_CMD=%~dp0..\..\node_modules\.bin\electron.cmd"

if defined ELECTRON_CMD (
  "%ELECTRON_CMD%" .
) else (
  echo Khong thay Electron local. Dang dung npx electron, co the can internet lan dau.
  npx electron .
)

pause
