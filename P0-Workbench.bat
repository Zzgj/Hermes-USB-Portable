@echo off
setlocal
:menu
echo.
echo Hermes Portable P0 RC1 - Acceptance Workbench
echo [1] Original launcher
echo [2] CLI chat
echo [3] TUI chat
echo [4] Web dashboard - localhost
echo [5] Desktop - requires installed assets
echo [6] Export P0 diagnostic report
echo [7] Setup / relocation repair
echo [8] Exit
choice /C 12345678 /N /M "Select: "
if errorlevel 8 exit /b 0
if errorlevel 7 goto repair
if errorlevel 6 goto diagnostic
if errorlevel 5 goto desktop
if errorlevel 4 goto web
if errorlevel 3 goto tui
if errorlevel 2 goto cli
call "%~dp0launch.bat"
goto menu
:cli
set "MODE=CLI"
goto open
:tui
set "MODE=TUI"
goto open
:web
set "MODE=Web"
goto open
:desktop
set "MODE=Desktop"
:open
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-hermes.ps1" -Root "%~dp0." -Mode %MODE%
pause
goto menu
:diagnostic
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\portable-diagnostics.ps1" -Root "%~dp0."
pause
goto menu
:repair
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-windows.ps1" -Root "%~dp0."
pause
goto menu
