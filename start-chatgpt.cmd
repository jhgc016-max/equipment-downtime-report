@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 for /d %%D in ("%~dp0.tools\node-v*-win-x64") do if exist "%%D\node.exe" set "PATH=%%~fD;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer, then run this file again.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)
if not exist "node_modules\@siwc\local\package.json" (
  call npm.cmd ci
  if errorlevel 1 goto failed
)
call npm.cmd run start:login
if errorlevel 1 goto failed
exit /b 0
:failed
echo Could not start. See the error above.
pause
exit /b 1
