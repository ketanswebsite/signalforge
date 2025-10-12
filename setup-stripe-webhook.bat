@echo off
setlocal enabledelayedexpansion

REM ============================================
REM Stripe Webhook Setup - Complete Automation
REM ============================================

color 0A
echo.
echo ================================================
echo    Stripe Webhook Setup for Local Development
echo ================================================
echo.

REM Check if Stripe CLI is installed
echo [Step 1/5] Checking Stripe CLI installation...
where stripe >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Stripe CLI is NOT installed!
    echo.
    echo Please install it using one of these methods:
    echo.
    echo Option 1 - Using Scoop ^(Recommended^):
    echo   scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
    echo   scoop install stripe
    echo.
    echo Option 2 - Manual Download:
    echo   1. Go to: https://github.com/stripe/stripe-cli/releases/latest
    echo   2. Download stripe_X.X.X_windows_x86_64.zip
    echo   3. Extract to C:\stripe
    echo   4. Add C:\stripe to your PATH environment variable
    echo.
    echo After installation, run this script again.
    echo.
    pause
    exit /b 1
)

stripe --version
echo [OK] Stripe CLI is installed!
echo.

REM Check if already logged in
echo [Step 2/5] Checking Stripe authentication...
stripe config --list >nul 2>&1
if %errorlevel% neq 0 (
    echo You need to login to Stripe.
    echo This will open your browser for authentication.
    echo.
    echo Press any key to open browser and login...
    pause >nul

    stripe login
    if !errorlevel! neq 0 (
        color 0C
        echo [ERROR] Login failed!
        pause
        exit /b 1
    )
) else (
    echo [OK] Already logged in to Stripe
)
echo.

REM Check if .env file exists
echo [Step 3/5] Checking environment configuration...
if not exist ".env" (
    color 0E
    echo [WARNING] .env file not found in current directory!
    echo Make sure you're running this from the project root folder.
    echo.
    set /p CONTINUE="Continue anyway? (Y/N): "
    if /i "!CONTINUE!" neq "Y" exit /b 1
)
echo [OK] Environment file found
echo.

REM Display webhook information
echo [Step 4/5] Starting webhook forwarding...
echo.
echo ================================================
echo    IMPORTANT INSTRUCTIONS
echo ================================================
echo.
echo 1. This will start forwarding Stripe webhooks to:
echo    http://localhost:3000/api/stripe/webhook
echo.
echo 2. Look for a line that says:
echo    "Ready! Your webhook signing secret is whsec_..."
echo.
echo 3. Copy the entire secret (starts with whsec_)
echo.
echo 4. Press Ctrl+C to stop when you're done testing
echo.
echo 5. After getting the secret, you need to:
echo    - Open .env file
echo    - Find STRIPE_WEBHOOK_SECRET=
echo    - Paste your secret after the = sign
echo    - Restart your Node.js server
echo.
echo ================================================
echo.
pause

REM Start the webhook listener
echo Starting Stripe webhook listener...
echo.
stripe listen --forward-to localhost:3000/api/stripe/webhook

echo.
echo Webhook listener stopped.
pause
