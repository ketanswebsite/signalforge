@echo off
REM ===============================================
REM    TASK-SPECIFIC RENDER DEPLOYMENT SCRIPT
REM    Enhanced for testing individual security fixes
REM ===============================================

setlocal enabledelayedexpansion

REM Color codes for better visual feedback
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "CYAN=[96m"
set "MAGENTA=[95m"
set "NC=[0m"

REM Get task information from user
echo %MAGENTA%===============================================%NC%
echo %MAGENTA%    STOCK PROXY - TASK FIX DEPLOYMENT%NC%
echo %MAGENTA%===============================================%NC%
echo.

REM Get current task number and description
set /p TASK_NUMBER="Enter task number being deployed (e.g., 1): "
set /p TASK_DESCRIPTION="Enter brief task description: "
set "TIMESTAMP=%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%-%time:~3,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"

echo.
echo %CYAN%Deploying Task #%TASK_NUMBER%: %TASK_DESCRIPTION%%NC%
echo %CYAN%Timestamp: %TIMESTAMP%%NC%
echo.

REM Pre-deployment checks
echo %BLUE%Step 1: Pre-Deployment Validation%NC%
echo ===============================================

REM Check if we're in the right directory
if not exist "server.js" (
    echo %RED%ERROR: server.js not found! Are you in the correct directory?%NC%
    pause
    exit /b 1
)

if not exist "package.json" (
    echo %RED%ERROR: package.json not found! Are you in the correct directory?%NC%
    pause
    exit /b 1
)

echo %GREEN%✓ Project files found%NC%

REM Check Git status
echo.
echo %BLUE%Step 2: Git Status Check%NC%
echo ===============================================
git status
echo.

REM Warning about uncommitted changes
git diff --quiet
if errorlevel 1 (
    echo %YELLOW%⚠️  WARNING: You have uncommitted changes!%NC%
    git status --porcelain
    echo.
    set /p continue="Continue with deployment? (y/N): "
    if /i not "!continue!"=="y" (
        echo %RED%❌ Deployment cancelled by user%NC%
        pause
        exit /b 1
    )
)

REM Add and commit changes
echo %BLUE%Step 3: Git Commit Process%NC%
echo ===============================================
git add .
if errorlevel 1 (
    echo %RED%❌ Failed to add files to git%NC%
    pause
    exit /b 1
)

set "COMMIT_MSG=Fix Task #%TASK_NUMBER%: %TASK_DESCRIPTION% - %TIMESTAMP%"
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo %YELLOW%⚠️  Nothing to commit or commit failed%NC%
    echo %CYAN%Continuing with deployment...%NC%
)

echo %GREEN%✓ Git commit completed%NC%

REM Push to GitHub
echo.
echo %BLUE%Step 4: Push to GitHub%NC%
echo ===============================================
git push origin main
if errorlevel 1 (
    echo %YELLOW%⚠️  Standard push failed, trying with upstream...%NC%
    git push -u origin main
    if errorlevel 1 (
        echo %RED%❌ Push failed! Check your git configuration%NC%
        echo %YELLOW%Common fixes:%NC%
        echo - Ensure you're logged into GitHub
        echo - Check your internet connection  
        echo - Verify repository permissions
        pause
        exit /b 1
    )
)

echo %GREEN%✓ Successfully pushed to GitHub!%NC%

REM Deployment monitoring
echo.
echo %BLUE%Step 5: Render Deployment Monitoring%NC%
echo ===============================================
echo %CYAN%Your code has been pushed. Render should start auto-deployment.%NC%
echo.

REM Task-specific testing instructions
echo %MAGENTA%TASK #%TASK_NUMBER% SPECIFIC TESTING INSTRUCTIONS%NC%
echo ===============================================

if "%TASK_NUMBER%"=="1" (
    call :test_task_1
) else if "%TASK_NUMBER%"=="2" (
    call :test_task_2  
) else if "%TASK_NUMBER%"=="3" (
    call :test_task_3
) else if "%TASK_NUMBER%"=="4" (
    call :test_task_4
) else if "%TASK_NUMBER%"=="5" (
    call :test_task_5
) else if "%TASK_NUMBER%"=="6" (
    call :test_task_6
) else (
    call :test_generic
)

REM General deployment verification
echo.
echo %BLUE%Step 6: General Deployment Verification%NC%
echo ===============================================
echo %YELLOW%🔍 MANDATORY CHECKS (Do these in order):%NC%
echo.
echo %CYAN%1. Monitor Render Dashboard:%NC%
echo    • Go to: https://dashboard.render.com
echo    • Find your stock-proxy service
echo    • Watch deployment progress (usually 2-5 minutes)
echo    • Look for %GREEN%"Deploy succeeded"%NC% status
echo.
echo %CYAN%2. Check Build Logs:%NC%
echo    • Click on your service → "Logs" tab
echo    • Look for: %GREEN%"✅ Build completed successfully!"%NC%
echo    • Look for: %GREEN%"✓ Database module loaded: PostgreSQL"%NC%
echo    • %RED%No errors should appear in logs%NC%
echo.
echo %CYAN%3. Test Application Access:%NC%
echo    • Visit your app URL (check dashboard for URL)
echo    • Should load without errors
echo    • Login page should appear
echo.
echo %CYAN%4. Test Database Connection:%NC%
echo    • Try logging in with Google OAuth
echo    • Should connect to PostgreSQL successfully
echo    • No SQLite fallback messages should appear
echo.

REM Post-deployment health checks
echo %BLUE%Step 7: Health Check Commands%NC%
echo ===============================================
echo %YELLOW%📋 Run these checks after successful deployment:%NC%
echo.
echo %CYAN%Manual Tests:%NC%
echo • Login/logout functionality
echo • Add a test trade
echo • Check if trades load from database
echo • Test any ML features
echo • Verify subscription system (if applicable)
echo.
echo %CYAN%API Tests (use browser console or Postman):%NC%
echo • GET /api/trades (should return JSON)
echo • GET /api/health (if available)
echo • POST /api/trades (with valid data)
echo.

REM Troubleshooting section
echo %BLUE%Step 8: Troubleshooting%NC%
echo ===============================================
echo %YELLOW%🔧 If deployment fails:%NC%
echo.
echo %RED%Common Issues:%NC%
echo • Build timeout: Check build.sh script
echo • Database connection: Verify DATABASE_URL env var
echo • Module errors: Check package.json dependencies  
echo • Environment variables: Verify all required vars are set
echo.
echo %CYAN%Debug Commands:%NC%
echo • Check Render logs for specific error messages
echo • Verify environment variables in Render dashboard
echo • Test locally first: npm start
echo • Check Git commit was successful: git log --oneline -5
echo.

echo %GREEN%===============================================%NC%
echo %GREEN%   DEPLOYMENT COMPLETE - READY FOR TESTING%NC%
echo %GREEN%===============================================%NC%
echo.
echo %YELLOW%✅ Next Steps:%NC%
echo 1. Wait for Render deployment to complete (2-5 minutes)
echo 2. Follow the task-specific testing instructions above
echo 3. Report results: SUCCESS ✅ or FAILURE ❌
echo 4. If SUCCESS: Move to next task
echo 5. If FAILURE: Debug and redeploy
echo.
echo %CYAN%🚀 Good luck testing Task #%TASK_NUMBER%!%NC%
echo.

pause
exit /b 0

REM =================
REM Task-specific testing functions
REM =================

:test_task_1
echo %GREEN%📋 TASK #1: eval() Security Fix Testing%NC%
echo.
echo %YELLOW%🎯 SPECIFIC TESTS FOR THIS TASK:%NC%
echo.
echo %CYAN%1. Security Verification:%NC%
echo    • %GREEN%✓ Verify no eval() usage in logs%NC%
echo    • %GREEN%✓ DTI scanner should load stock lists successfully%NC%
echo    • %GREEN%✓ Look for: "✅ Loaded comprehensive stock lists: 2377 total stocks"%NC%
echo    • %RED%❌ Should NOT see: "Failed to parse [array] safely"%NC%
echo.
echo %CYAN%2. Functionality Testing:%NC%
echo    • Test DTI backtesting feature (if accessible)
echo    • Check stock scanning functionality  
echo    • Verify ML features still work
echo    • Test Telegram bot notifications (if configured)
echo.
echo %CYAN%3. Log Analysis:%NC%
echo    • Check Render logs for stock list loading
echo    • Verify no JavaScript parsing errors
echo    • Confirm JSON.parse() is working correctly
echo.
echo %RED%🚨 CRITICAL SUCCESS CRITERIA:%NC%
echo    • Application starts without eval() related errors
echo    • Stock lists load successfully (2377+ stocks)
echo    • No security warnings in browser console
echo    • DTI calculations work correctly
goto :eof

:test_task_2
echo %GREEN%📋 TASK #2: Session Secret Security Fix Testing%NC%
echo.
echo %YELLOW%🎯 SPECIFIC TESTS FOR THIS TASK:%NC%
echo.
echo %CYAN%1. Environment Variable Testing:%NC%
echo    • %GREEN%✓ App should FAIL if SESSION_SECRET not set%NC%
echo    • %GREEN%✓ App should FAIL if SESSION_SECRET is weak%NC%
echo    • %GREEN%✓ App should START if SESSION_SECRET is strong%NC%
echo.
echo %CYAN%2. Session Security Testing:%NC%
echo    • Login and verify session cookies are secure
echo    • Test session persistence across requests
echo    • Verify no fallback secret is used
echo.
echo %RED%🚨 CRITICAL SUCCESS CRITERIA:%NC%
echo    • No fallback session secret in code
echo    • Strong session secret validation works
echo    • Sessions work properly with strong secret
goto :eof

:test_task_3
echo %GREEN%📋 TASK #3: Hardcoded Admin Email Fix Testing%NC%
echo.
echo %YELLOW%🎯 SPECIFIC TESTS FOR THIS TASK:%NC%
echo.
echo %CYAN%1. Environment Variable Testing:%NC%
echo    • %GREEN%✓ App should FAIL if ADMIN_EMAIL not set%NC%
echo    • %GREEN%✓ Admin functionality works with env var%NC%
echo.
echo %RED%🚨 CRITICAL SUCCESS CRITERIA:%NC%
echo    • No hardcoded admin email in code
echo    • Admin functionality works via environment variable
goto :eof

:test_task_4
echo %GREEN%📋 TASK #4: Dependency Vulnerability Fix Testing%NC%
echo.
echo %YELLOW%🎯 SPECIFIC TESTS FOR THIS TASK:%NC%
echo.
echo %CYAN%1. Security Scanning:%NC%
echo    • %GREEN%✓ npm audit should show 0 vulnerabilities%NC%
echo    • %GREEN%✓ All features should work after updates%NC%
echo.
echo %RED%🚨 CRITICAL SUCCESS CRITERIA:%NC%
echo    • Zero security vulnerabilities
echo    • All functionality preserved
goto :eof

:test_task_5
echo %GREEN%📋 TASK #5: Express Downgrade Testing%NC%
echo.
echo %YELLOW%🎯 SPECIFIC TESTS FOR THIS TASK:%NC%
echo.
echo %CYAN%1. Stability Testing:%NC%
echo    • %GREEN%✓ App should use Express 4.x (stable)%NC%
echo    • %GREEN%✓ All middleware should work%NC%
echo    • %GREEN%✓ All API endpoints should function%NC%
echo.
echo %RED%🚨 CRITICAL SUCCESS CRITERIA:%NC%
echo    • Stable Express version
echo    • All functionality preserved
goto :eof

:test_task_6
echo %GREEN%📋 TASK #6: SQLite Fallback Removal Testing%NC%
echo.
echo %YELLOW%🎯 SPECIFIC TESTS FOR THIS TASK:%NC%
echo.
echo %CYAN%1. Database Testing:%NC%
echo    • %GREEN%✓ App should use PostgreSQL ONLY%NC%
echo    • %GREEN%✓ App should FAIL if PostgreSQL not available%NC%
echo    • %RED%❌ Should NOT see SQLite fallback messages%NC%
echo.
echo %RED%🚨 CRITICAL SUCCESS CRITERIA:%NC%
echo    • PostgreSQL only, no fallbacks
echo    • Fail fast if database unavailable
goto :eof

:test_generic
echo %GREEN%📋 TASK #%TASK_NUMBER%: General Testing Guidelines%NC%
echo.
echo %YELLOW%🎯 GENERAL TESTING APPROACH:%NC%
echo.
echo %CYAN%1. Functionality Testing:%NC%
echo    • Test the specific feature that was fixed
echo    • Verify the fix works as expected
echo    • Check that related functionality still works
echo.
echo %CYAN%2. Security Testing:%NC%
echo    • Verify security issue is resolved
echo    • Test edge cases and error conditions
echo    • Check browser console for errors
echo.
echo %CYAN%3. Integration Testing:%NC%
echo    • Test user workflows end-to-end
echo    • Verify database operations work
echo    • Check API endpoints respond correctly
goto :eof