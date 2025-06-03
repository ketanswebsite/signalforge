@echo off
echo ========================================
echo   CLEANING UP TEMPORARY FILES
echo ========================================
echo.

echo Deleting temporary fix files and scripts...
echo.

REM Delete temporary batch files
del /Q commit-session-fix.bat 2>nul
del /Q commit-button-fix.bat 2>nul
del /Q push-clean.bat 2>nul
del /Q test-auth-local.bat 2>nul
del /Q check-render-logs.bat 2>nul
del /Q verify-render-env.bat 2>nul
del /Q generate-new-session-secret.bat 2>nul

REM Delete temporary documentation files
del /Q RENDER_ENV_VARS.txt 2>nul
del /Q RENDER_REQUIRED_ENV_VARS.txt 2>nul
del /Q OAUTH_SETUP.md 2>nul
del /Q SECURITY_FIXES_REQUIRED.md 2>nul

echo.
echo Files cleaned up successfully!
echo.
echo Keeping essential files:
echo - .env (local configuration)
echo - deploy-to-render.bat (deployment script)
echo - deploy-oauth-render.bat (OAuth deployment guide)
echo - setup.bat / setup.sh (setup scripts)
echo - start.bat / start.sh (startup scripts)
echo - build.sh (Render build script)
echo.
pause