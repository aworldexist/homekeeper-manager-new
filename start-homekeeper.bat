@echo off
cd /d "%~dp0"
set "PATH=C:\Users\1\.workbuddy\binaries\node\versions\22.22.2-6;%PATH%"

if not exist "node_modules\vite" (
  echo Installing dependencies, please wait...
  call npm ci --no-audit --no-fund --registry=https://registry.npmmirror.com
  if errorlevel 1 goto fail
)

echo.
echo Starting HomeKeeper...
echo Keep this window open. Press Ctrl+C to stop.
echo.
start "" http://localhost:5173/
call npm run dev
goto end

:fail
echo.
echo Install failed. Check your network connection and try again.
pause
exit /b 1

:end
pause
