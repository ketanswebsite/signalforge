@echo off
setlocal enabledelayedexpansion
title SignalForge - Deploy to Render

echo ========================================
echo   SIGNALFORGE DEPLOYMENT TO RENDER
echo ========================================
echo.

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

REM Check for uncommitted changes
echo Checking for uncommitted changes...
git diff-index --quiet HEAD -- 2>nul
if errorlevel 1 (
    echo.
    echo WARNING: You have uncommitted changes:
    echo ----------------------------------------
    git status --short
    echo ----------------------------------------
    echo.
    choice /C YN /M "Do you want to commit these changes"
    if errorlevel 2 (
        echo.
        echo Proceeding without committing changes...
        echo Note: Only committed changes will be deployed to Render
    ) else (
        echo.
        set /p commit_msg=Enter commit message: 
        git add .
        git commit -m "!commit_msg!"
        if errorlevel 1 (
            echo.
            echo ERROR: Failed to commit changes!
            echo.
            echo The commit message might not have been captured properly.
            echo Please commit manually with:
            echo.
            echo   git add .
            echo   git commit -m "Fix UK stock price updates when markets closed and add deploy script"
            echo.
            echo Then run this script again to push to Render.
            echo.
            pause
            exit /b
        )
        echo.
        echo Changes committed successfully!
    )
) else (
    echo No uncommitted changes found.
)

echo.
echo ========================================
echo   PUSHING TO REMOTE
echo ========================================
echo.

REM Check if render.yaml exists
if not exist render.yaml (
    echo WARNING: render.yaml not found!
    echo Make sure you have configured your Render deployment
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

REM Push to main branch
echo Pushing to origin/main...
git push origin main
if errorlevel 1 (
    echo.
    echo ERROR: Failed to push to remote repository!
    echo.
    echo Possible issues:
    echo - Check your internet connection
    echo - Make sure you have push access to the repository
    echo - Try: git pull origin main --rebase
    echo.
    pause
    exit /b
)

echo.
echo ========================================
echo   DEPLOYMENT SUCCESSFUL!
echo ========================================
echo.
echo Your code has been pushed to the main branch.
echo.
echo NEXT STEPS:
echo 1. Go to https://dashboard.render.com/
echo 2. Your service should auto-deploy from the latest commit
echo 3. Check the deployment logs in Render dashboard
echo.
echo IMPORTANT:
echo - Ensure environment variables are set in Render
echo - Database persists at /opt/render/project/src
echo - Monitor logs in Render dashboard
echo.

choice /C YN /M "Open Render dashboard in browser"
if errorlevel 1 if not errorlevel 2 (
    start https://dashboard.render.com/
)

echo.
echo Deployment script completed.
pause