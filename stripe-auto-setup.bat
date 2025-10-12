@echo off
setlocal enabledelayedexpansion

REM ============================================
REM Stripe Auto-Setup with Secret Capture
REM ============================================

title Stripe Webhook Auto-Setup
color 0A

echo.
echo =========================================================
echo    Stripe Webhook Auto-Setup with Secret Capture
echo =========================================================
echo.

REM Check Stripe CLI
echo [1/6] Checking Stripe CLI...
where stripe >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Stripe CLI not found!
    echo.
    echo Install with: scoop install stripe
    echo Or download: https://github.com/stripe/stripe-cli/releases/latest
    echo.
    pause
    exit /b 1
)
echo [OK] Stripe CLI found
stripe --version
echo.

REM Login check
echo [2/6] Verifying Stripe authentication...
stripe config --list >nul 2>&1
if %errorlevel% neq 0 (
    echo Opening browser for Stripe login...
    stripe login
    if !errorlevel! neq 0 (
        echo [ERROR] Login failed!
        pause
        exit /b 1
    )
)
echo [OK] Authenticated
echo.

REM Check .env
echo [3/6] Locating .env file...
if not exist ".env" (
    color 0E
    echo [WARNING] .env file not found!
    echo Current directory: %CD%
    echo.
    set /p CONTINUE="Continue anyway? (Y/N): "
    if /i "!CONTINUE!" neq "Y" exit /b 1
)
echo [OK] Found .env file
echo.

REM Capture webhook secret using PowerShell
echo [4/6] Starting webhook listener to capture secret...
echo.
echo Forwarding to: http://localhost:3000/api/stripe/webhook
echo.
echo Waiting for webhook secret... (this may take 5-10 seconds)
echo.

REM Create PowerShell script to capture the secret
echo $ErrorActionPreference = 'SilentlyContinue' > %TEMP%\capture_stripe.ps1
echo $process = Start-Process -FilePath "stripe" -ArgumentList "listen --forward-to localhost:3000/api/stripe/webhook" -NoNewWindow -PassThru -RedirectStandardOutput "%TEMP%\stripe_output.txt" >> %TEMP%\capture_stripe.ps1
echo Start-Sleep -Seconds 8 >> %TEMP%\capture_stripe.ps1
echo Stop-Process -Id $process.Id -Force >> %TEMP%\capture_stripe.ps1

powershell -ExecutionPolicy Bypass -File "%TEMP%\capture_stripe.ps1" >nul 2>&1

REM Extract secret from output
if exist "%TEMP%\stripe_output.txt" (
    for /f "tokens=*" %%a in ('findstr /C:"whsec_" "%TEMP%\stripe_output.txt"') do (
        set LINE=%%a
        REM Extract just the secret part
        for /f "tokens=7 delims= " %%b in ("!LINE!") do set WEBHOOK_SECRET=%%b
    )
)

if defined WEBHOOK_SECRET (
    echo [OK] Webhook secret captured!
    echo.
    echo Secret: !WEBHOOK_SECRET!
    echo.

    REM Update .env file
    echo [5/6] Updating .env file...

    REM Check if STRIPE_WEBHOOK_SECRET already exists
    findstr /C:"STRIPE_WEBHOOK_SECRET=" .env >nul 2>&1
    if %errorlevel% equ 0 (
        REM Update existing line
        powershell -Command "(Get-Content .env) -replace 'STRIPE_WEBHOOK_SECRET=.*', 'STRIPE_WEBHOOK_SECRET=!WEBHOOK_SECRET!' | Set-Content .env"
        echo [OK] Updated existing STRIPE_WEBHOOK_SECRET in .env
    ) else (
        REM Add new line
        echo STRIPE_WEBHOOK_SECRET=!WEBHOOK_SECRET!>> .env
        echo [OK] Added STRIPE_WEBHOOK_SECRET to .env
    )
    echo.

    echo [6/6] Setup complete!
    echo.
    color 0A
    echo =========================================================
    echo    SUCCESS! Webhook secret has been saved to .env
    echo =========================================================
    echo.
    echo Next steps:
    echo   1. Restart your Node.js server: npm start
    echo   2. In a NEW terminal, run: stripe listen --forward-to localhost:3000/api/stripe/webhook
    echo   3. Keep that terminal open while testing
    echo   4. Visit: http://localhost:3000/pricing.html
    echo.
) else (
    color 0E
    echo [WARNING] Could not automatically capture secret.
    echo.
    echo Please follow manual steps:
    echo   1. Open a new terminal
    echo   2. Run: stripe listen --forward-to localhost:3000/api/stripe/webhook
    echo   3. Copy the webhook secret (starts with whsec_)
    echo   4. Add to .env: STRIPE_WEBHOOK_SECRET=your_secret_here
    echo   5. Restart your server
    echo.
)

REM Cleanup
del "%TEMP%\capture_stripe.ps1" >nul 2>&1
del "%TEMP%\stripe_output.txt" >nul 2>&1

echo.
pause
