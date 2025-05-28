@echo off
REM Quick deployment script for updates after initial setup

echo.
echo Quick Deploy to Render
echo =====================
echo.

git add .
git commit -m "Update: %date% %time%"
git push

echo.
echo Deployment triggered! Check Render dashboard for status.
echo https://dashboard.render.com
echo.
pause