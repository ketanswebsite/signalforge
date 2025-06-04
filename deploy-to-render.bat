@echo off
echo ===============================================
echo    RENDER DEPLOYMENT SCRIPT
echo ===============================================
echo.

:: Set error handling
setlocal enabledelayedexpansion

:: Color codes for better output
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

echo %BLUE%Step 1: Checking Git Status%NC%
echo ===============================================
git status
echo.

echo %BLUE%Step 2: Checking for uncommitted changes%NC%
echo ===============================================
git diff --quiet
if errorlevel 1 (
    echo %YELLOW%Warning: You have uncommitted changes!%NC%
    git status --porcelain
    echo.
    set /p continue="Do you want to continue anyway? (y/N): "
    if /i not "!continue!"=="y" (
        echo %RED%Deployment cancelled.%NC%
        exit /b 1
    )
)

echo %BLUE%Step 3: Adding all changes to git%NC%
echo ===============================================
git add .
if errorlevel 1 (
    echo %RED%Failed to add files to git%NC%
    exit /b 1
)

echo %BLUE%Step 4: Creating commit%NC%
echo ===============================================
set "timestamp=%date:~10,4%-%date:~4,2%-%date:~7,2% %time:~0,2%:%time:~3,2%"
git commit -m "Auto-deploy: %timestamp%"
if errorlevel 1 (
    echo %YELLOW%Nothing to commit or commit failed%NC%
    echo Continuing with deployment...
)

echo %BLUE%Step 5: Pushing to main branch%NC%
echo ===============================================
git push origin main
if errorlevel 1 (
    echo %RED%Failed to push to origin main%NC%
    echo %YELLOW%Trying to set upstream and push...%NC%
    git push -u origin main
    if errorlevel 1 (
        echo %RED%Push failed! Please check your git configuration.%NC%
        exit /b 1
    )
)

echo %GREEN%✓ Successfully pushed to GitHub!%NC%
echo.

echo %BLUE%Step 6: Deployment Verification Steps%NC%
echo ===============================================
echo %YELLOW%Please follow these steps to verify your deployment:%NC%
echo.
echo 1. %BLUE%Check Render Dashboard:%NC%
echo    - Go to https://dashboard.render.com
echo    - Find your stock-proxy service
echo    - Check if deployment is triggered automatically
echo.
echo 2. %BLUE%Monitor Build Logs:%NC%
echo    - Click on your service in Render dashboard
echo    - Go to "Logs" tab
echo    - Watch for build completion and any errors
echo.
echo 3. %BLUE%Verify PostgreSQL Connection:%NC%
echo    - Wait for deployment to complete
echo    - Check logs for "✓ Database module loaded: PostgreSQL"
echo    - Should NOT see any JSON fallback messages
echo.
echo 4. %BLUE%Test Application:%NC%
echo    - Visit your Render app URL
echo    - Try logging in
echo    - Check if trades are loading from PostgreSQL
echo    - Test adding a new trade
echo.
echo 5. %BLUE%Check Database Tables:%NC%
echo    - Visit: https://your-app.onrender.com/check-subscription-setup.html
echo    - Verify all PostgreSQL tables are present
echo    - Check subscription functionality
echo.

echo %BLUE%Step 7: Post-Deployment Health Checks%NC%
echo ===============================================
echo %YELLOW%Run these checks after deployment:%NC%
echo.
echo • %BLUE%Application Status:%NC% Check if app starts without errors
echo • %BLUE%Database Connection:%NC% Verify PostgreSQL connection is successful
echo • %BLUE%API Endpoints:%NC% Test /api/trades and other endpoints
echo • %BLUE%Authentication:%NC% Test login/logout functionality
echo • %BLUE%Subscription System:%NC% Verify subscription middleware works
echo • %BLUE%ML Features:%NC% Check if ML routes are accessible
echo.

echo %BLUE%Step 8: Troubleshooting Commands%NC%
echo ===============================================
echo %YELLOW%If deployment fails, try these:%NC%
echo.
echo • Check Render logs for specific error messages
echo • Verify DATABASE_URL environment variable is set
echo • Ensure all required environment variables are configured
echo • Check if build.sh script runs successfully
echo • Verify package.json dependencies are correct
echo.

echo %GREEN%===============================================%NC%
echo %GREEN%   DEPLOYMENT INITIATED SUCCESSFULLY!%NC%
echo %GREEN%===============================================%NC%
echo.
echo %YELLOW%Your code has been pushed to GitHub.%NC%
echo %YELLOW%Render should automatically start deploying.%NC%
echo.
echo %BLUE%Next steps:%NC%
echo 1. Monitor Render dashboard for deployment progress
echo 2. Check application logs for any errors
echo 3. Test the live application once deployment completes
echo 4. Verify PostgreSQL database is working correctly
echo.
echo %GREEN%Good luck with your deployment! 🚀%NC%
echo.

pause