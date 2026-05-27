@echo off
cd /d %~dp0
echo Starting Local CMD Agent...
npm run electron:dev
