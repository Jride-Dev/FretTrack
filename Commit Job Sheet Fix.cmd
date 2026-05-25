@echo off
setlocal

cd /d "%~dp0"

echo.
echo FretTrack - Commit Job Sheet Fix
echo ================================
echo.

git status
echo.

echo Staging Job Sheet print fix files...
git add CHANGELOG.md src/modules/jobs/JobPrintSheet.js
if errorlevel 1 goto error

echo.
echo Creating commit...
git commit -m "Fix job sheet tech summary printing"
if errorlevel 1 goto error

echo.
echo Pushing branch...
git push
if errorlevel 1 (
  echo.
  echo Regular push failed. Trying to set upstream for the current branch...
  git push -u origin HEAD
  if errorlevel 1 goto error
)

echo.
echo Done. The Job Sheet fix has been committed and pushed.
pause
exit /b 0

:error
echo.
echo Something failed. Check the message above.
pause
exit /b 1
