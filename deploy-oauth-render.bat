@echo off
setlocal enabledelayedexpansion
title SignalForge - Deploy OAuth2 to Render

echo ============================================
echo   SIGNALFORGE OAUTH2 DEPLOYMENT TO RENDER
echo ============================================
echo.

REM Check if we have a Render service URL
echo Please enter your Render service URL
echo (e.g., https://stock-proxy.onrender.com or https://your-app-name.onrender.com)
set /p render_url=Render URL: 

if "%render_url%"=="" (
    echo ERROR: Render URL is required!
    pause
    exit /b
)

REM Remove trailing slash if present
if "%render_url:~-1%"=="/" set render_url=%render_url:~0,-1%

echo.
echo ============================================
echo   ENVIRONMENT VARIABLES FOR RENDER
echo ============================================
echo.
echo Copy these environment variables from your .env file to Render:
echo.
echo 1. GOOGLE_CLIENT_ID     (from .env file)
echo 2. GOOGLE_CLIENT_SECRET (from .env file)
echo 3. CALLBACK_URL=%render_url%/auth/google/callback
echo 4. SESSION_SECRET       (from .env file)
echo 5. ALLOWED_USERS        (from .env file)
echo 6. NODE_ENV=production
echo.
echo SECURITY NOTE: Never commit secrets to git!
echo The values are stored safely in your local .env file
echo.
echo ============================================
echo   IMPORTANT STEPS:
echo ============================================
echo.
echo 1. UPDATE GOOGLE CONSOLE:
echo    - Go to https://console.cloud.google.com/
echo    - Select your project
echo    - Go to APIs ^& Services ^> Credentials
echo    - Click on your OAuth 2.0 Client ID
echo    - Add this to Authorized redirect URIs:
echo      %render_url%/auth/google/callback
echo    - Click Save
echo.
echo 2. UPDATE RENDER ENVIRONMENT:
echo    - Go to https://dashboard.render.com/
echo    - Select your service
echo    - Go to Environment tab
echo    - Add ALL the environment variables from your .env file
echo    - Make sure CALLBACK_URL uses your Render URL
echo    - Click Save Changes
echo.
echo 3. DEPLOY YOUR CODE:
echo    Press any key to run the deployment script...
echo.
pause

REM Run the existing deployment script
call deploy-to-render.bat

echo.
echo ============================================
echo   POST-DEPLOYMENT CHECKLIST:
echo ============================================
echo.
echo [ ] Google Console updated with Render callback URL
echo [ ] All environment variables added to Render
echo [ ] Service redeployed with new environment variables
echo [ ] Test login at: %render_url%
echo.
echo If login fails, check:
echo - Render logs for errors
echo - Google Console redirect URI matches exactly
echo - Environment variables are set correctly
echo.
pause