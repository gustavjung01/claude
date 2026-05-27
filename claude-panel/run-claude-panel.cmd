@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Chua co Node.js hoac node chua nam trong PATH.
  echo Cai Node.js LTS roi chay lai file nay.
  pause
  exit /b 1
)

echo Dang mo Claude Proxy Panel...
start "" "http://127.0.0.1:8787"
node server.js

pause
