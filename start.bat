@echo off
echo ================================
echo DTI Stock Trading Backtester
echo ================================
echo.

REM Kill any existing Node processes
echo Cleaning up any existing Node processes...
taskkill /f /im node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo Stopped existing Node processes.
    REM Wait a moment for ports to be released
    timeout /t 2 /nobreak >nul
) else (
    echo No existing Node processes found.
)

echo.
echo Starting server...
echo.

REM Check if app.js exists (new server), otherwise use server.js
if exist app.js (
    echo Using app.js server...
    node app.js
) else (
    echo Using server.js...
    node server.js
)

if %errorlevel% neq 0 (
    echo.
    echo ================================
    echo ERROR: Failed to start server!
    echo ================================
    echo.
    echo Possible issues:
    echo - Missing node_modules (run: npm install)
    echo - Database connection error
    echo - Port 3000 already in use by another application
    echo.
    pause
    exit /b 1
)

pause