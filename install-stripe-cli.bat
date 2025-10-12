@echo off
setlocal enabledelayedexpansion

REM ============================================
REM Install Stripe CLI - No Scoop Required!
REM ============================================

title Installing Stripe CLI
color 0B

echo.
echo ================================================
echo    Stripe CLI Installation (Direct Download)
echo ================================================
echo.

REM Check if Stripe CLI is already installed
where stripe >nul 2>&1
if %errorlevel% equ 0 (
    color 0A
    echo [OK] Stripe CLI is already installed!
    stripe --version
    echo.
    echo Press any key to continue to setup...
    pause >nul
    goto :SETUP
)

echo [Step 1/4] Checking prerequisites...
echo.

REM Check if we have PowerShell
powershell -Command "Write-Output 'PowerShell available'" >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] PowerShell is required but not found!
    echo Please run this script as Administrator.
    pause
    exit /b 1
)
echo [OK] PowerShell found
echo.

REM Create installation directory
echo [Step 2/4] Creating installation directory...
set "INSTALL_DIR=%USERPROFILE%\stripe-cli"
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
)
echo [OK] Directory: %INSTALL_DIR%
echo.

REM Download Stripe CLI
echo [Step 3/4] Downloading Stripe CLI...
echo This may take a minute depending on your connection...
echo.

powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/stripe/stripe-cli/releases/latest/download/stripe_latest_windows_x86_64.zip' -OutFile '%TEMP%\stripe.zip' }"

if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Failed to download Stripe CLI
    echo.
    echo Please download manually from:
    echo https://github.com/stripe/stripe-cli/releases/latest
    echo.
    pause
    exit /b 1
)

echo [OK] Download complete
echo.

REM Extract the zip file
echo [Step 4/4] Extracting files...
powershell -Command "Expand-Archive -Path '%TEMP%\stripe.zip' -DestinationPath '%INSTALL_DIR%' -Force"

if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Failed to extract files
    pause
    exit /b 1
)

REM Clean up
del "%TEMP%\stripe.zip" >nul 2>&1

echo [OK] Extraction complete
echo.

REM Add to PATH for this session
set "PATH=%INSTALL_DIR%;%PATH%"

REM Add to PATH permanently
echo Adding to system PATH...
powershell -Command "& { $oldPath = [Environment]::GetEnvironmentVariable('Path', 'User'); if ($oldPath -notlike '*%INSTALL_DIR%*') { [Environment]::SetEnvironmentVariable('Path', $oldPath + ';%INSTALL_DIR%', 'User') } }"

echo.
color 0A
echo ================================================
echo    SUCCESS! Stripe CLI Installed
echo ================================================
echo.
echo Installation directory: %INSTALL_DIR%
echo.
echo Verifying installation...
"%INSTALL_DIR%\stripe.exe" --version
echo.

REM Ask if user wants to continue to setup
echo.
set /p CONTINUE="Do you want to continue with Stripe setup now? (Y/N): "
if /i "!CONTINUE!"=="Y" (
    goto :SETUP
) else (
    echo.
    echo You can run 'stripe-auto-setup.bat' anytime to complete setup.
    echo NOTE: You may need to close and reopen this terminal for PATH changes to take effect.
    echo.
    pause
    exit /b 0
)

:SETUP
echo.
echo ================================================
echo    Starting Stripe Auto-Setup
echo ================================================
echo.
echo This will:
echo  1. Login to Stripe (opens browser)
echo  2. Capture webhook secret
echo  3. Update your .env file
echo.
pause

REM Run the auto-setup script
if exist "stripe-auto-setup.bat" (
    call stripe-auto-setup.bat
) else (
    color 0E
    echo [WARNING] stripe-auto-setup.bat not found!
    echo Please run it manually after closing this window.
    echo.
    pause
)

endlocal
