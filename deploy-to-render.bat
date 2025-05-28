@echo off
echo.
echo =====================================
echo   STOCK PROXY - RENDER DEPLOYMENT
echo =====================================
echo.

REM Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed or not in PATH
    echo Please install Git from https://git-scm.com/download/win
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "package.json" (
    echo ERROR: package.json not found!
    echo Please run this script from the stock-proxy directory
    pause
    exit /b 1
)

echo [1/7] Checking Git repository status...
echo.

REM Initialize git if needed
if not exist ".git" (
    echo Initializing Git repository...
    git init
    echo Git repository initialized.
) else (
    echo Git repository already exists.
)

REM Check for uncommitted changes
git status --porcelain > temp_git_status.txt
set /p git_status=<temp_git_status.txt
del temp_git_status.txt

if not "%git_status%"=="" (
    echo [2/7] Adding files to Git...
    git add .
    echo.
    
    echo [3/7] Creating commit...
    git commit -m "Update for Render deployment with persistent database"
    echo.
) else (
    echo [2/7] No changes to commit
    echo [3/7] Skipping commit
    echo.
)

echo [4/7] Checking GitHub remote...
echo.

REM Check if remote exists
git remote -v | findstr "origin" >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo   ACTION REQUIRED: Create GitHub Repo
    echo ========================================
    echo.
    echo 1. Go to https://github.com/new
    echo 2. Create a new repository named: stock-proxy
    echo 3. Make it PUBLIC (required for free Render deployment)
    echo 4. Do NOT initialize with README
    echo 5. Click "Create repository"
    echo.
    echo After creating, copy the repository URL
    echo It should look like: https://github.com/YOUR_USERNAME/stock-proxy.git
    echo.
    set /p repo_url="Paste your repository URL here: "
    
    if "%repo_url%"=="" (
        echo ERROR: No URL provided
        pause
        exit /b 1
    )
    
    echo.
    echo Adding GitHub remote...
    git remote add origin %repo_url%
    
    if %errorlevel% neq 0 (
        echo ERROR: Failed to add remote
        pause
        exit /b 1
    )
    
    echo Remote added successfully!
) else (
    echo GitHub remote already configured.
    git remote -v
)

echo.
echo [5/7] Setting main branch...
git branch -M main

echo.
echo [6/7] Pushing to GitHub...
echo.

REM Try to push
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo   PUSH FAILED - POSSIBLE SOLUTIONS:
    echo ========================================
    echo.
    echo 1. If authentication failed:
    echo    - You may need to set up a GitHub Personal Access Token
    echo    - Go to: https://github.com/settings/tokens
    echo    - Generate a new token with 'repo' permissions
    echo    - Use the token as your password when prompted
    echo.
    echo 2. If remote has existing commits:
    echo    - Run: git pull origin main --allow-unrelated-histories
    echo    - Then run this script again
    echo.
    echo 3. If permission denied:
    echo    - Make sure the repository is PUBLIC
    echo    - Check that you're logged into the correct GitHub account
    echo.
    pause
    exit /b 1
)

echo.
echo [7/7] GitHub push successful!
echo.
echo =====================================
echo   NEXT STEPS FOR RENDER DEPLOYMENT
echo =====================================
echo.
echo 1. Go to https://render.com
echo.
echo 2. Sign in with GitHub (recommended)
echo.
echo 3. Click "New +" then "Web Service"
echo.
echo 4. Connect your GitHub account if not already connected
echo.
echo 5. Select the "stock-proxy" repository
echo.
echo 6. Render will auto-detect the render.yaml file
echo.
echo 7. IMPORTANT: Make sure you're on a PAID plan for persistent storage
echo    - The Starter plan ($7/month) includes persistent disks
echo    - Free tier will NOT save your trades data
echo.
echo 8. Click "Create Web Service"
echo.
echo 9. Add these Environment Variables in Render dashboard:
echo    - NODE_ENV = production
echo    - TELEGRAM_BOT_TOKEN = your_bot_token (if using Telegram)
echo    - TELEGRAM_CHAT_ID = your_chat_id (if using Telegram)
echo.
echo 10. Wait for deployment to complete (5-10 minutes)
echo.
echo Your app will be available at:
echo https://stock-proxy.onrender.com
echo.
echo =====================================
echo   MONITORING YOUR DEPLOYMENT
echo =====================================
echo.
echo - Check logs in Render dashboard for any errors
echo - Look for "Database initialized successfully at: /var/data/trades.db"
echo - Verify the persistent disk is attached at /var/data
echo.
echo Press any key to open Render.com in your browser...
pause >nul

start https://render.com

echo.
echo =====================================
echo   FUTURE UPDATES
echo =====================================
echo.
echo To deploy updates in the future, just run:
echo.
echo   git add .
echo   git commit -m "Your update message"
echo   git push
echo.
echo Render will automatically redeploy!
echo.
echo Script completed successfully!
echo.
pause