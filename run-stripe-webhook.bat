@echo off
REM ============================================
REM Run Stripe Webhook Listener
REM Keep this running while testing payments
REM ============================================

title Stripe Webhook Listener - Keep Open!
color 0B

echo.
echo ================================================
echo    Stripe Webhook Listener
echo ================================================
echo.
echo This window will forward Stripe webhooks to:
echo http://localhost:3000/api/stripe/webhook
echo.
echo IMPORTANT: Keep this window open while testing!
echo.
echo Press Ctrl+C to stop when done testing
echo.
echo ================================================
echo.

REM Check if Stripe CLI is installed
where stripe >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Stripe CLI not found!
    echo Please run: setup-stripe-webhook.bat first
    echo.
    pause
    exit /b 1
)

REM Check if logged in
stripe config --list >nul 2>&1
if %errorlevel% neq 0 (
    echo You need to login first.
    echo.
    set /p LOGIN="Run stripe login now? (Y/N): "
    if /i "!LOGIN!"=="Y" (
        stripe login
    ) else (
        echo Please login manually: stripe login
        pause
        exit /b 1
    )
)

echo Starting webhook forwarding...
echo.
echo ================================================
echo    COPY YOUR WEBHOOK SECRET FROM BELOW
echo ================================================
echo.
echo Look for a line that says:
echo "Ready! Your webhook signing secret is whsec_..."
echo.
echo Copy the ENTIRE secret and add it to your .env file:
echo STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
echo.
echo Then restart your Node.js server.
echo.
echo ================================================
echo.

REM Start the listener
stripe listen --forward-to localhost:3000/api/stripe/webhook

echo.
echo Webhook listener stopped.
echo.
pause
