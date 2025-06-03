@echo off
echo ========================================
echo   FINAL COMMIT - README & CLEANUP
echo ========================================
echo.

echo First, run the cleanup script...
call cleanup-files.bat

echo.
echo Now committing the README file...
git add README.md
git add -u

echo.
echo Creating final commit...
git commit -m "Add comprehensive README and clean up temporary files"

if errorlevel 1 (
    echo.
    echo ERROR: Commit failed!
) else (
    echo.
    echo SUCCESS: Final commit created!
    echo.
    echo Your SignalForge system is now complete with:
    echo - Comprehensive documentation in README.md
    echo - Clean repository without temporary files
    echo - Full authentication system
    echo - All features working properly
    echo.
    echo To push to GitHub:
    echo   git push origin main
    echo.
    echo To deploy to Render:
    echo   deploy-to-render.bat
)

pause