@echo off
echo ===============================================
echo    POST-DEPLOYMENT VERIFICATION SCRIPT
echo ===============================================
echo.

:: Color codes for better output
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

:: Get the app URL from user
set /p APP_URL="Enter your Render app URL (e.g., https://your-app.onrender.com): "

if "%APP_URL%"=="" (
    echo %RED%Error: Please provide your Render app URL%NC%
    pause
    exit /b 1
)

echo.
echo %BLUE%Testing deployment for: %APP_URL%%NC%
echo.

echo %BLUE%1. Testing Main Application%NC%
echo ===============================================
curl -s -o nul -w "Status: %%{http_code} | Time: %%{time_total}s\n" %APP_URL%
if errorlevel 1 (
    echo %RED%✗ Main app not accessible%NC%
) else (
    echo %GREEN%✓ Main app is accessible%NC%
)
echo.

echo %BLUE%2. Testing Login Page%NC%
echo ===============================================
curl -s -o nul -w "Status: %%{http_code} | Time: %%{time_total}s\n" %APP_URL%/login.html
if errorlevel 1 (
    echo %RED%✗ Login page not accessible%NC%
) else (
    echo %GREEN%✓ Login page is accessible%NC%
)
echo.

echo %BLUE%3. Testing Trades Page%NC%
echo ===============================================
curl -s -o nul -w "Status: %%{http_code} | Time: %%{time_total}s\n" %APP_URL%/trades.html
if errorlevel 1 (
    echo %RED%✗ Trades page not accessible%NC%
) else (
    echo %GREEN%✓ Trades page is accessible%NC%
)
echo.

echo %BLUE%4. Testing Subscription Setup%NC%
echo ===============================================
curl -s -o nul -w "Status: %%{http_code} | Time: %%{time_total}s\n" %APP_URL%/check-subscription-setup.html
if errorlevel 1 (
    echo %RED%✗ Subscription setup page not accessible%NC%
) else (
    echo %GREEN%✓ Subscription setup page is accessible%NC%
)
echo.

echo %BLUE%5. Testing API Health%NC%
echo ===============================================
curl -s -o nul -w "Status: %%{http_code} | Time: %%{time_total}s\n" %APP_URL%/api/health
if errorlevel 1 (
    echo %RED%✗ API health check failed%NC%
) else (
    echo %GREEN%✓ API health check passed%NC%
)
echo.

echo %BLUE%Manual Verification Steps%NC%
echo ===============================================
echo %YELLOW%Please manually verify the following:%NC%
echo.
echo 1. %BLUE%Open your app:%NC% %APP_URL%
echo    • Check if the page loads without errors
echo    • Verify the UI renders correctly
echo.
echo 2. %BLUE%Test Authentication:%NC%
echo    • Try logging in with valid credentials
echo    • Check if session management works
echo.
echo 3. %BLUE%Test Database Connection:%NC%
echo    • Go to %APP_URL%/check-subscription-setup.html
echo    • Verify PostgreSQL connection status
echo    • Check if all tables are created
echo.
echo 4. %BLUE%Test Trade Operations:%NC%
echo    • Add a new trade
echo    • View existing trades
echo    • Check if data persists in PostgreSQL
echo.
echo 5. %BLUE%Check Server Logs:%NC%
echo    • Go to Render dashboard
echo    • View application logs
echo    • Look for any errors or warnings
echo    • Confirm "PostgreSQL" database connection message
echo.
echo 6. %BLUE%Test Subscription Features:%NC%
echo    • Check subscription middleware
echo    • Test ML integration routes
echo    • Verify GDPR compliance features
echo.

echo %BLUE%Common Issues to Check%NC%
echo ===============================================
echo %YELLOW%If you encounter issues:%NC%
echo.
echo • %RED%500 Errors:%NC% Check DATABASE_URL environment variable
echo • %RED%Database Issues:%NC% Verify PostgreSQL connection in logs
echo • %RED%Missing Features:%NC% Check if all files were deployed
echo • %RED%Authentication Problems:%NC% Verify session configuration
echo • %RED%Performance Issues:%NC% Check server resources and logs
echo.

echo %BLUE%Environment Variables to Verify%NC%
echo ===============================================
echo %YELLOW%Make sure these are set in Render:%NC%
echo.
echo • DATABASE_URL (PostgreSQL connection string)
echo • NODE_ENV (should be 'production')
echo • SESSION_SECRET (for authentication)
echo • Any API keys or tokens you're using
echo.

echo %GREEN%===============================================%NC%
echo %GREEN%   VERIFICATION COMPLETE%NC%
echo %GREEN%===============================================%NC%
echo.
echo %BLUE%If all tests pass, your deployment is successful!%NC%
echo %YELLOW%If any tests fail, check the Render logs for details.%NC%
echo.

pause