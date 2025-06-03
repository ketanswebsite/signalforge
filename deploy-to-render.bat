@echo off
setlocal enabledelayedexpansion
title SignalForge - Deploy to Render

echo ========================================
echo   SIGNALFORGE DEPLOYMENT TO RENDER
echo ========================================
echo.

REM Change to script directory
cd /d "%~dp0"

REM Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed or not in PATH
    echo Please install Git from https://git-scm.com/
    echo.
    pause
    exit /b
)

REM Check if we're in a git repository
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo ERROR: This is not a git repository!
    echo Please initialize git first with: git init
    echo.
    pause
    exit /b
)

REM Show current branch
echo Current branch:
git branch --show-current
echo.

REM Pull latest changes first to avoid conflicts
echo Checking for remote updates...
git fetch origin >nul 2>&1
git status -uno | findstr /C:"Your branch is behind" >nul
if not errorlevel 1 (
    echo.
    echo WARNING: Your branch is behind origin/main
    echo Automatically pulling latest changes...
    git pull origin main
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to pull changes. Please resolve conflicts manually.
        pause
        exit /b
    )
)

REM Check for uncommitted changes
echo.
echo Checking for uncommitted changes...
git status --porcelain >nul 2>&1
if errorlevel 1 (
    echo Error checking git status
    pause
    exit /b
)

REM Count changes
set changes=0
for /f "tokens=*" %%i in ('git status --porcelain 2^>nul') do set /a changes+=1

if !changes! gtr 0 (
    echo.
    echo You have !changes! uncommitted changes:
    echo ----------------------------------------
    git status --short
    echo ----------------------------------------
    echo.
    
    REM Auto-stage all changes
    echo Staging all changes...
    git add -A
    
    REM Generate default commit message with timestamp
    for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
    set "YYYY=!dt:~0,4!"
    set "MM=!dt:~4,2!"
    set "DD=!dt:~6,2!"
    set "HH=!dt:~8,2!"
    set "Min=!dt:~10,2!"
    
    set default_msg=Auto-deploy: !DD!-!MM!-!YYYY! !HH!:!Min!
    
    echo.
    echo Auto-committing with message: "!default_msg!"
    git commit -m "!default_msg!"
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to commit changes!
        pause
        exit /b
    )
    echo.
    echo Changes committed successfully!
) else (
    echo No uncommitted changes found.
)

echo.
echo ========================================
echo   PUSHING TO GITHUB
echo ========================================
echo.

REM Check if render.yaml exists
if not exist render.yaml (
    echo WARNING: render.yaml not found!
    echo Make sure you have configured your Render deployment
    echo.
)

REM Check if remote exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo ERROR: No git remote 'origin' found!
    echo Please add your git remote first:
    echo   git remote add origin YOUR_GIT_REPO_URL
    echo.
    pause
    exit /b
)

REM Show what we're about to push
echo Commits to be pushed:
echo ----------------------------------------
git log origin/main..HEAD --oneline
if errorlevel 1 (
    echo No new commits to push.
)
echo ----------------------------------------

REM Push to main branch with retry logic
echo.
echo Pushing to origin/main...
git push origin main
if errorlevel 1 (
    echo.
    echo WARNING: Initial push failed. Trying to pull and merge first...
    git pull origin main --no-rebase
    if errorlevel 1 (
        echo.
        echo ERROR: Merge conflicts detected!
        echo Please resolve conflicts manually and try again.
        pause
        exit /b
    )
    echo.
    echo Retrying push after merge...
    git push origin main
    if errorlevel 1 (
        echo.
        echo ERROR: Push still failed. Attempting force push...
        echo This may overwrite remote changes!
        git push origin main --force-with-lease
        if errorlevel 1 (
            echo.
            echo ERROR: All push attempts failed! Please check:
            echo - Your internet connection
            echo - GitHub authentication (try: gh auth login)
            echo - Repository permissions
            echo.
            echo Manual fix: Run 'git push origin main' manually
            pause
            exit /b
        )
        echo.
        echo SUCCESS: Force push completed!
    )
)

echo.
echo ========================================
echo   DEPLOYMENT SUCCESSFUL!
echo ========================================
echo.
echo Your code has been pushed to GitHub.
echo.
echo Render auto-deployment status:
echo 1. Go to https://dashboard.render.com/
echo 2. Your service should auto-deploy from this commit
echo 3. Deployment usually takes 2-5 minutes
echo.

REM Show recent commits
echo Recent commits pushed:
echo ----------------------------------------
git log --oneline -5
echo ----------------------------------------
echo.

echo ========================================
echo   POST-DEPLOYMENT STEPS
echo ========================================
echo.
echo IMPORTANT: After deployment completes on Render:
echo.
echo 1. Verify the application is running:
echo    - Check your app URL for successful deployment
echo    - Test login and basic functionality
echo.
echo 2. Test the Admin Dashboard user migration:
echo    - Go to /admin page after deployment
echo    - Verify that Total Users shows correct count (not 0)
echo    - Check that existing users appear in the users table
echo    - Test that new user logins get saved to users table
echo.
echo 3. Verify PostgreSQL user tracking:
echo    - Existing users should be migrated from trades table
echo    - New Google OAuth logins should create user records
echo    - Admin page should show all registered users
echo.
echo 4. Test API field standardization:
echo    - Open Developer Tools and check API responses
echo    - Verify 'shares' and 'profitLoss' fields are present
echo    - No more 'quantity' or 'profit' fields should appear
echo.
echo 5. Verify Telegram alerts are working:
echo    - Test alert preferences in the app
echo    - Check that notifications use correct field values
echo.
echo ========================================
echo.
echo Auto-opening Render dashboard to monitor deployment...
echo.
echo You can also check:
echo - Render Dashboard: https://dashboard.render.com/
echo - GitHub Repository: 
git remote get-url origin 2>nul | findstr /C:"github.com"
echo.
start https://dashboard.render.com/

:end
echo.
echo Deployment script completed.
echo.
echo Remember: 
echo 1. Test the Admin Dashboard shows users correctly
echo 2. Verify user migration worked for existing trades
echo 3. Test new user registration via Google OAuth
pause