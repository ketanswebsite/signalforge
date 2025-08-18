@echo off
echo ==========================================
echo    Stock Proxy - Deploy to Render
echo ==========================================
echo.

:: Check if git is available
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed or not in PATH
    echo Please install Git and try again
    pause
    exit /b 1
)

:: Check if we're in a git repository
if not exist ".git" (
    echo ERROR: Not in a git repository
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

echo 1. Checking current directory...
echo Current directory: %cd%
echo.

:: Check for required files
echo 2. Checking required files...
if not exist "package.json" (
    echo ERROR: package.json not found
    pause
    exit /b 1
)
if not exist "server.js" (
    echo ERROR: server.js not found
    pause
    exit /b 1
)
if not exist "render.yaml" (
    echo ERROR: render.yaml not found
    pause
    exit /b 1
)
echo ✓ All required files found
echo.

:: Show current git status
echo 3. Current git status:
git status --porcelain
echo.

:: Check for uncommitted changes
git diff-index --quiet HEAD -- >nul 2>&1
if errorlevel 1 (
    echo 4. Found uncommitted changes. Staging and committing...
    
    :: Add all changes
    echo   - Adding all changes...
    git add .
    
    :: Create commit with timestamp
    for /f "tokens=1-4 delims=/ " %%i in ('date /t') do set mydate=%%k-%%j-%%i
    for /f "tokens=1-2 delims=: " %%i in ('time /t') do set mytime=%%i:%%j
    set datetime=%mydate% %mytime%
    
    echo   - Creating commit...
    git commit -m "Auto-deploy: %datetime%"
    
    if errorlevel 1 (
        echo ERROR: Failed to commit changes
        pause
        exit /b 1
    )
    echo ✓ Changes committed successfully
) else (
    echo 4. No uncommitted changes found
)
echo.

:: Check if origin remote exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo ERROR: No 'origin' remote found
    echo Please add your GitHub repository as origin:
    echo   git remote add origin https://github.com/yourusername/your-repo.git
    pause
    exit /b 1
)

:: Get current branch
for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD') do set current_branch=%%i
echo 5. Current branch: %current_branch%
echo.

:: Push to GitHub
echo 6. Pushing to GitHub...
git push origin %current_branch%
if errorlevel 1 (
    echo ERROR: Failed to push to GitHub
    echo Please check your GitHub credentials and repository access
    pause
    exit /b 1
)
echo ✓ Successfully pushed to GitHub
echo.

:: Display deployment information
echo ==========================================
echo    DEPLOYMENT COMPLETE
echo ==========================================
echo.
echo Your code has been pushed to GitHub.
echo.
echo NEXT STEPS:
echo 1. Go to https://render.com
echo 2. Connect your GitHub repository
echo 3. Create a new Web Service
echo 4. Configure the following settings:
echo.
echo    Build Command: npm install
echo    Start Command: npm start
echo    Node Version: 18 or higher
echo.
echo REQUIRED ENVIRONMENT VARIABLES:
echo ================================
echo Set these in your Render dashboard:
echo.
echo DATABASE_URL=your_postgresql_connection_string
echo SESSION_SECRET=your_secure_session_secret
echo GOOGLE_CLIENT_ID=your_google_oauth_client_id
echo GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
echo TELEGRAM_BOT_TOKEN=your_telegram_bot_token (optional)
echo TELEGRAM_CHAT_ID=your_telegram_chat_id (optional)
echo NODE_ENV=production
echo.
echo OPTIONAL VARIABLES:
echo ==================
echo DEBUG_CRON=true (for testing cron jobs)
echo DTI_DEBUG=true (for debugging DTI scans)
echo.
echo DATABASE SETUP:
echo ==============
echo 1. Create a PostgreSQL database on Render
echo 2. Copy the connection string to DATABASE_URL
echo 3. The app will automatically create tables on first run
echo.
echo Your GitHub repository is ready for Render deployment!
echo.
pause