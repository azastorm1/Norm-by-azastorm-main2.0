@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js not found. Install it from https://nodejs.org and run this file again. & pause & exit /b)
start "" http://localhost:3000
node server.js
pause
