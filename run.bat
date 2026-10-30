@echo off
rem Starts the game: installs what's needed, builds it and opens it in the browser.
rem Works from any folder, or by double-clicking. Press Ctrl+C to stop the game.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or later is needed to run the game: https://nodejs.org/
  pause
  exit /b 1
)

call npm.cmd start
if errorlevel 1 pause
