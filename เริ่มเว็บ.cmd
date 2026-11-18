@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Please run npm ci first.
  pause
  exit /b 1
)
if not exist .env copy .env.example .env >nul
if not exist out\index.html (
  call npm run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Open http://127.0.0.1:9000 in your browser.
call npm start
pause
