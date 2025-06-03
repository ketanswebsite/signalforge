@echo off
echo Creating backup of all data...
node backup-restore.js backup
echo.
echo Backup complete! File: backup-data.json
pause