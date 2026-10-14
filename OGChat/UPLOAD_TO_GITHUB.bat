@echo off
setlocal
cd /d "%~dp0"
echo OGChat GitHub uploader
where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: Git is not installed. Install Git for Windows from https://git-scm.com/download/win
  pause
  exit /b 1
)
if not exist .git git init
 git branch -M main
 git add .
 git commit -m "Upload OGChat Phase 4"
if errorlevel 1 (
  echo If Git says there is nothing to commit, continuing to push.
)
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin https://github.com/lokeshbaskar-droid/OGChat.git
) else (
  git remote set-url origin https://github.com/lokeshbaskar-droid/OGChat.git
)
git push -u origin main
if errorlevel 1 (
  echo.
  echo Push failed. Check GitHub login, repository permissions, and whether the remote repository already contains commits.
  pause
  exit /b 1
)
echo.
echo Upload completed successfully.
pause
