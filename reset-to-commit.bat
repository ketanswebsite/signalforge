@echo off
echo ========================================
echo Resetting to commit 2c1112a
echo ========================================
echo.

REM First, save any important changes
echo Stashing any local changes...
git stash -u

echo.
echo Fetching latest from origin...
git fetch origin

echo.
echo Resetting to commit 2c1112a...
git reset --hard 2c1112a

echo.
echo ========================================
echo Reset complete!
echo ========================================
echo.
echo Current commit:
git log -1 --oneline

echo.
echo If you had any local changes, they were stashed.
echo To restore them later, run: git stash pop
echo.
pause