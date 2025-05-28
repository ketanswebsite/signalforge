@echo off
echo Stopping all Node.js processes...
taskkill /f /im node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo Successfully stopped all Node processes.
) else (
    echo No Node processes were running.
)
echo.
pause