@echo off
netstat -ano | findstr ":3080" | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo [dsh] already running: http://127.0.0.1:3080
  start http://127.0.0.1:3080
  exit /b 0
)
cd /d E:\deepseek-harness
start "" cmd /c "timeout /t 8 /nobreak >nul & start http://127.0.0.1:3080"
pnpm dsh web
