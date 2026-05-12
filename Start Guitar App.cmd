@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Start Guitar App.ps1"

if errorlevel 1 (
  echo.
  echo The app launcher hit an error. Leave this window open and read the message above.
  pause
)
