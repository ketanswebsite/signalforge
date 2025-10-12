@echo off
REM ============================================
REM Quick Start - Stripe Setup (All-in-One)
REM ============================================

title Stripe Setup - Quick Start
color 0B

echo.
echo ========================================
echo    Stripe Setup - Quick Start
echo ========================================
echo.

REM Check if stripe.exe exists
if not exist "stripe.exe" (
    color 0C
    echo [ERROR] stripe.exe not found in current directory!
    echo.
    echo Please make sure you're running this from the project folder.
    echo.
    pause
    exit /b 1
)

echo [OK] Stripe CLI found
stripe.exe --version
echo.

echo ========================================
echo    Step 1: Login to Stripe
echo ========================================
echo.
echo Your browser will open. Please:
echo  1. Login to your Stripe account
echo  2. Click "Allow access"
echo  3. Come back to this window
echo.
pause

REM Login to Stripe
stripe.exe login

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Login failed!
    echo Please try again.
    pause
    exit /b 1
)

echo.
color 0A
echo [OK] Successfully logged in!
echo.

echo ========================================
echo    Step 2: Get Webhook Secret
echo ========================================
echo.
echo Starting webhook listener...
echo.
echo IMPORTANT:
echo Look for a line that says:
echo "Ready! Your webhook signing secret is whsec_..."
echo.
echo Copy the ENTIRE secret (whsec_xxxxx...)
echo.
pause

REM Start the webhook listener
echo Starting listener...
echo.
stripe.exe listen --forward-to localhost:3000/api/stripe/webhook

echo.
echo Listener stopped.
pause
