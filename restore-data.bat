@echo off
echo Restoring data from backup...
node backup-restore.js restore
echo.
echo Restore complete!
pause