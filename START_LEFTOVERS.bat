@echo off
cd /d "%~dp0"
title Leftovers
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  pause
  exit /b 1
)
start "Leftovers Server" cmd /k "cd /d ""%~dp0"" && set PORT=8081 && node server.js"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8081"
