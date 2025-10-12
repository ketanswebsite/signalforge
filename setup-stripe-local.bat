@echo off
REM ============================================
REM Stripe CLI Local Setup - Automated
REM ============================================
echo.
echo ============================================
echo    Stripe CLI Local Setup
echo ============================================
echo.

REM Check if Stripe CLI is installed
echo [1/4] Checking if Stripe CLI is installed...
stripe --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Stripe CLI is not installed!
    echo.
    echo Please install Stripe CLI first:
    echo.
    echo Option 1 - Using Scoop:
    echo   scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
    echo   scoop install stripe
    echo.
    echo Option 2 - Manual Download:
    echo   Download from: https://github.com/stripe/stripe-cli/releases/latest
    echo   Extract and add to PATH
    echo.
    pause
    exit /b 1
)

echo [OK] Stripe CLI is installed
stripe --version
echo.

REM Login to Stripe
echo [2/4] Logging in to Stripe...
echo.
echo This will open your browser. Please login and authorize the CLI.
echo Press any key to continue...
pause >nul

stripe login
if %errorlevel% neq 0 (
    echo [ERROR] Stripe login failed!
    pause
    exit /b 1
)

echo [OK] Successfully logged in to Stripe
echo.

REM Start webhook forwarding and capture the secret
echo [3/4] Starting webhook forwarding...
echo.
echo IMPORTANT: Keep this window open!
echo The webhook secret will be displayed below.
echo Copy it when it appears (starts with whsec_)
echo.
echo Starting webhook listener...
echo.

REM Create a temporary file to capture output
set TEMP_FILE=%TEMP%\stripe_webhook_secret.txt

REM Start stripe listen and capture output
echo Forwarding webhooks to: http://localhost:3000/api/stripe/webhook
echo.

stripe listen --forward-to localhost:3000/api/stripe/webhook

REM Note: The script will stay here while stripe listen is running
REM The user needs to manually stop it with Ctrl+C when done testing

pause
