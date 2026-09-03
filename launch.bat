@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM Hermes Agent - Portable Launcher (Windows)
REM ============================================================================
REM Double-click this file to launch Hermes.
REM On first run, it downloads ~600MB of runtime files automatically.
REM Generated state and logs stay inside this portable folder.
REM ============================================================================

REM Resolve portable root (directory containing this script)
set "PORTABLE_ROOT=%~dp0"
set "PORTABLE_ROOT=%PORTABLE_ROOT:~0,-1%"

set "HERMES_HOME=%PORTABLE_ROOT%\data"
set "CACHE_DIR=%PORTABLE_ROOT%\.cache"
set "RUNTIME_DIR=%CACHE_DIR%\runtimes\windows-x64"
set "SRC_DIR=%PORTABLE_ROOT%\src"
set "LOG_ROOT=%PORTABLE_ROOT%\logs"
call :write_portable_event launcher launcher-start started

REM ---------------------------------------------------------------------------
REM First-run setup
REM ---------------------------------------------------------------------------
if not exist "%RUNTIME_DIR%\ready.flag" (
    echo.
    echo ============================================
    echo    Hermes Portable - First Run Setup
    echo ============================================
    echo  This will download ~600MB of runtime files
    echo  for Windows x64. Please be patient.
    echo ============================================
    echo.
    call :write_portable_event setup runtime-setup started
    powershell -ExecutionPolicy Bypass -File "%PORTABLE_ROOT%\scripts\setup-windows.ps1" -Root "%PORTABLE_ROOT%"
    if errorlevel 1 (
        call :write_portable_event setup runtime-setup failed
        echo.
        echo [ERROR] Setup failed. Please check your internet connection and try again.
        pause
        exit /b 1
    )
    call :write_portable_event setup runtime-setup succeeded
)

REM ---------------------------------------------------------------------------
REM Environment isolation - keep everything inside the portable folder
REM ---------------------------------------------------------------------------
set "VIRTUAL_ENV=%RUNTIME_DIR%\venv"
set "PATH=%VIRTUAL_ENV%\Scripts;%RUNTIME_DIR%\python;%RUNTIME_DIR%\python\Scripts;%RUNTIME_DIR%\node;%RUNTIME_DIR%\uv;%RUNTIME_DIR%\bin;%PATH%"
set "PYTHONNOUSERSITE=1"
set "PYTHONHOME="
set "PYTHONPATH="
set "UV_NO_CONFIG=1"
set "UV_PYTHON=%RUNTIME_DIR%\python\python.exe"
set "PLAYWRIGHT_BROWSERS_PATH=%RUNTIME_DIR%\playwright"
set "NODE_PATH=%RUNTIME_DIR%\node\node_modules"
set "NPM_CONFIG_PREFIX=%RUNTIME_DIR%\node"

REM Prevent Node from writing to host appdata
set "APPDATA=%PORTABLE_ROOT%\.cache\windows-appdata"
set "LOCALAPPDATA=%PORTABLE_ROOT%\.cache\windows-localappdata"

REM ---------------------------------------------------------------------------
REM Update pyvenv.cfg with the current absolute path to ensure portability
REM ---------------------------------------------------------------------------
if exist "%VIRTUAL_ENV%\pyvenv.cfg" (
    for /f "tokens=2" %%v in ('"%RUNTIME_DIR%\python\python.exe" --version 2^>nul') do set "PYTHON_VERSION=%%v"
    if not defined PYTHON_VERSION set "PYTHON_VERSION=3.11.15"
    (
    echo home = %RUNTIME_DIR%\python
    echo include-system-site-packages = false
    echo version = !PYTHON_VERSION!
    ) > "%VIRTUAL_ENV%\pyvenv.cfg"
)

REM ---------------------------------------------------------------------------
REM Launch Hermes
REM ---------------------------------------------------------------------------
if not exist "%SRC_DIR%\hermes-agent" (
    echo [ERROR] Hermes source not found. Please delete .cache and try again.
    pause
    exit /b 1
)

cd /d "%SRC_DIR%\hermes-agent"

REM Strip "hermes" from the start of arguments if user typed "launch.bat hermes setup"
set "ARGS=%*"
if /I "%~1"=="hermes" (
    set "ARGS=%ARGS:~7%"
)

REM If explicit arguments were passed, run Hermes directly (skip menu)
if not "%ARGS%"=="" (
    call :write_portable_event launcher direct-command started
    python -c "from hermes_cli.main import main; main()" %ARGS%
    set "DIRECT_EXIT=!errorlevel!"
    if not "!DIRECT_EXIT!"=="0" (
        call :write_portable_event launcher direct-command failed
        exit /b !DIRECT_EXIT!
    )
    call :write_portable_event launcher direct-command succeeded
    exit /b 0
)

REM ---------------------------------------------------------------------------
REM ANSI Color Setup
REM ---------------------------------------------------------------------------
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "RESET=%ESC%[0m"
set "BOLD=%ESC%[1m"
set "DIM=%ESC%[2m"
set "CYAN=%ESC%[36m"
set "BRIGHT_CYAN=%ESC%[96m"
set "GREEN=%ESC%[32m"
set "BRIGHT_GREEN=%ESC%[92m"
set "YELLOW=%ESC%[33m"
set "BRIGHT_YELLOW=%ESC%[93m"
set "RED=%ESC%[31m"
set "BRIGHT_RED=%ESC%[91m"
set "WHITE=%ESC%[37m"
set "BRIGHT_WHITE=%ESC%[97m"
set "GRAY=%ESC%[90m"
set "BG_CYAN=%ESC%[46m%ESC%[30m"
set "BG_DARK=%ESC%[40m%ESC%[37m"

REM ---------------------------------------------------------------------------
REM Status Detection
REM ---------------------------------------------------------------------------
:detect_status
set "SETUP_STATUS=Not configured"
set "SETUP_ICON=[x]"
set "SETUP_COLOR=%RED%"
set "PROVIDER_NAME="
set "MODEL_NAME="
if exist "%HERMES_HOME%\.env" (
    findstr /R /C:"^[A-Z].*=" "%HERMES_HOME%\.env" >nul 2>&1
    if not errorlevel 1 (
        set "SETUP_STATUS=Configured"
        set "SETUP_ICON=[OK]"
        set "SETUP_COLOR=%BRIGHT_GREEN%"
    )
)

if exist "%HERMES_HOME%\config.yaml" (
    for /f "usebackq tokens=2 delims=: " %%a in (`findstr /R /C:"^  provider:" "%HERMES_HOME%\config.yaml"`) do (
        if not defined PROVIDER_NAME set "PROVIDER_NAME=%%a"
    )
    for /f "usebackq tokens=2 delims=: " %%a in (`findstr /R /C:"^  default:" "%HERMES_HOME%\config.yaml"`) do (
        if not defined MODEL_NAME set "MODEL_NAME=%%a"
    )
)

set "GATEWAY_STATUS=Stopped"
set "GATEWAY_ICON=[ ]"
set "GATEWAY_COLOR=%GRAY%"
set "GATEWAY_PID="
if exist "%HERMES_HOME%\gateway.pid" (
    for /f "usebackq tokens=2 delims=:," %%a in (`findstr /R /C:"\"pid\"" "%HERMES_HOME%\gateway.pid"`) do (
        set "raw=%%a"
        set "GATEWAY_PID=!raw: =!"
    )
)
if defined GATEWAY_PID (
    tasklist /FI "PID eq !GATEWAY_PID!" 2>nul | findstr /I "!GATEWAY_PID!" >nul
    if not errorlevel 1 (
        set "GATEWAY_STATUS=Running (PID !GATEWAY_PID!)"
        set "GATEWAY_ICON=[OK]"
        set "GATEWAY_COLOR=%BRIGHT_GREEN%"
    ) else (
        set "GATEWAY_STATUS=Stopped (stale lock)"
        set "GATEWAY_ICON=[!]"
        set "GATEWAY_COLOR=%YELLOW%"
    )
)

set "HERMES_VERSION=unknown"
if exist "%SRC_DIR%\hermes-agent\hermes_cli\__init__.py" (
    for /f "usebackq tokens=3" %%a in (`findstr /R /C:"__version__" "%SRC_DIR%\hermes-agent\hermes_cli\__init__.py"`) do (
        set "rawver=%%a"
        set "HERMES_VERSION=!rawver:"=!"
    )
)

REM ---------------------------------------------------------------------------
REM Main Menu
REM ---------------------------------------------------------------------------
:show_menu
echo.
echo.
echo %BRIGHT_CYAN%----------------------------------------------------------------%RESET%
echo %BOLD%%BRIGHT_WHITE%                    HERMES PORTABLE LAUNCHER%RESET%
echo %DIM%%GRAY%                         AI Agent for Everyone%RESET%
echo %BRIGHT_CYAN%----------------------------------------------------------------%RESET%
echo.
echo  %DIM%Setup%RESET%    !SETUP_COLOR!!SETUP_ICON!%RESET% %WHITE%!SETUP_STATUS!%RESET%
if defined PROVIDER_NAME echo  %DIM%Provider%RESET% %CYAN%!PROVIDER_NAME!%RESET%
if defined MODEL_NAME echo  %DIM%Model%RESET%    %WHITE%!MODEL_NAME!%RESET%
echo  %DIM%Gateway%RESET%  !GATEWAY_COLOR!!GATEWAY_ICON!%RESET% %WHITE%!GATEWAY_STATUS!%RESET%
echo  %DIM%Version%RESET%  %GRAY%v!HERMES_VERSION!%RESET%
echo.
echo %BRIGHT_CYAN%----------------------------------------------------------------%RESET%
echo.
echo  %BRIGHT_YELLOW%[1]%RESET%  %WHITE%Start Hermes Chat%RESET%
echo  %BRIGHT_YELLOW%[2]%RESET%  %WHITE%Setup / Reconfigure Hermes%RESET%
if "!GATEWAY_STATUS!"=="Running (PID !GATEWAY_PID!)" (
    echo  %BRIGHT_YELLOW%[3]%RESET%  %WHITE%Stop Gateway%RESET%  %RED%[live]%RESET%
) else (
    echo  %BRIGHT_YELLOW%[3]%RESET%  %WHITE%Start Gateway%RESET%
)
echo  %BRIGHT_YELLOW%[4]%RESET%  %WHITE%Advanced Options%RESET%  %GRAY%--^>%RESET%
echo  %BRIGHT_YELLOW%[5]%RESET%  %GRAY%Exit%RESET%
echo.
echo %BRIGHT_CYAN%----------------------------------------------------------------%RESET%
echo.

echo %BRIGHT_CYAN%Select option:%RESET% & choice /C 12345 /N
if errorlevel 5 goto :menu_exit
if errorlevel 4 goto :show_advanced
if errorlevel 3 goto :menu_gateway
if errorlevel 2 goto :menu_setup
if errorlevel 1 goto :menu_chat
goto :show_menu

REM ---------------------------------------------------------------------------
REM Menu Actions
REM ---------------------------------------------------------------------------
:menu_chat
echo.
call :write_portable_event launcher chat started
python -c "from hermes_cli.main import main; main()"
if errorlevel 1 (
    call :write_portable_event launcher chat failed
) else (
    call :write_portable_event launcher chat succeeded
)
goto :show_menu

:menu_setup
echo.
call :write_portable_event launcher hermes-setup started
python -c "from hermes_cli.main import main; main()" setup
if errorlevel 1 (
    call :write_portable_event launcher hermes-setup failed
) else (
    call :write_portable_event launcher hermes-setup succeeded
)
goto :detect_status

:menu_gateway
if "!GATEWAY_STATUS!"=="Running (PID !GATEWAY_PID!)" (
    call :write_portable_event launcher gateway-stop started
    python -c "from hermes_cli.main import main; main()" gateway stop
    if errorlevel 1 (
        call :write_portable_event launcher gateway-stop failed
    ) else (
        call :write_portable_event launcher gateway-stop succeeded
    )
    echo.
    echo %BRIGHT_GREEN%Gateway stopped.%RESET%
) else (
    echo.
    echo %CYAN%Starting gateway in background ...%RESET%
    call :write_portable_event launcher gateway-start started
    start "" python -c "from hermes_cli.main import main; main()" gateway
    call :write_portable_event launcher gateway-start observed
    timeout /t 2 /nobreak >nul
)
pause
goto :detect_status

:menu_exit
call :write_portable_event launcher launcher-exit observed
echo.
echo.
echo %GRAY%Goodbye!%RESET%
echo.
exit /b

REM ---------------------------------------------------------------------------
REM Advanced Menu
REM ---------------------------------------------------------------------------
:show_advanced
echo.
echo.
echo %BRIGHT_CYAN%----------------------------------------------------------------%RESET%
echo %BOLD%%BRIGHT_WHITE%                       Advanced Options%RESET%
echo %BRIGHT_CYAN%----------------------------------------------------------------%RESET%
echo.
echo  %BRIGHT_YELLOW%[1]%RESET%  %WHITE%Run Doctor%RESET%            %GRAY%- check for issues%RESET%
echo  %BRIGHT_YELLOW%[2]%RESET%  %WHITE%View Logs%RESET%             %GRAY%- central paths + gateway tail%RESET%
echo  %BRIGHT_YELLOW%[3]%RESET%  %WHITE%Edit Config%RESET%           %GRAY%- open in editor%RESET%
echo  %BRIGHT_YELLOW%[4]%RESET%  %WHITE%Restart Gateway%RESET%       %GRAY%- stop + start%RESET%
echo  %BRIGHT_YELLOW%[5]%RESET%  %WHITE%Check for Updates%RESET%      %GRAY%- read-only%RESET%
echo  %BRIGHT_YELLOW%[6]%RESET%  %WHITE%Update Hermes%RESET%         %GRAY%- review + confirm%RESET%
echo  %BRIGHT_YELLOW%[7]%RESET%  %GRAY%Back to Main Menu%RESET%
echo.
echo %BRIGHT_CYAN%----------------------------------------------------------------%RESET%
echo.

echo %BRIGHT_CYAN%Select option:%RESET% & choice /C 1234567 /N
if errorlevel 7 goto :show_menu
if errorlevel 6 goto :adv_update
if errorlevel 5 goto :adv_update_check
if errorlevel 4 goto :adv_restart
if errorlevel 3 goto :adv_config
if errorlevel 2 goto :adv_logs
if errorlevel 1 goto :adv_doctor
goto :show_advanced

:adv_doctor
echo.
call :write_portable_event doctor doctor started
powershell -NoProfile -ExecutionPolicy Bypass -File "%PORTABLE_ROOT%\scripts\invoke-hermes-observation.ps1" -Root "%PORTABLE_ROOT%" -Operation doctor
if errorlevel 1 (
    call :write_portable_event doctor doctor failed
) else (
    call :write_portable_event doctor doctor succeeded
)
pause
goto :show_advanced

:adv_logs
echo.
echo %CYAN%Workbench logs:%RESET% %LOG_ROOT%
echo %CYAN%Hermes logs:%RESET%    %HERMES_HOME%\logs
echo %CYAN%Log catalog:%RESET%    %PORTABLE_ROOT%\manifests\log-sources.json
echo.
if exist "%HERMES_HOME%\logs\gateway.log" (
    echo %CYAN%=== Gateway Log (last 20 lines) ===%RESET%
    powershell -Command "Get-Content '%HERMES_HOME%\logs\gateway.log' -Tail 20"
) else (
    echo %YELLOW%No logs found.%RESET%
)
echo.
pause
goto :show_advanced

:adv_config
echo.
python -c "from hermes_cli.main import main; main()" config edit
goto :show_advanced

:adv_restart
python -c "from hermes_cli.main import main; main()" gateway restart
echo.
echo %BRIGHT_GREEN%Gateway restarted.%RESET%
pause
goto :detect_status

:adv_update
echo.
echo %CYAN%Reviewing the official Hermes update plan...%RESET%
powershell -NoProfile -ExecutionPolicy Bypass -File "%PORTABLE_ROOT%\scripts\invoke-hermes-observation.ps1" -Root "%PORTABLE_ROOT%" -Operation update-plan
if errorlevel 1 (
    call :write_portable_event diagnostics update-plan failed
    echo.
    echo %BRIGHT_RED%[ERROR] Update plan failed. No update was applied.%RESET%
    pause
    goto :show_advanced
)
call :write_portable_event diagnostics update-plan succeeded
echo.
choice /C YN /N /M "Continue with the official Hermes update from origin/main? [Y/N] "
if errorlevel 2 (
    call :write_portable_event diagnostics update-apply cancelled
    goto :show_advanced
)
if errorlevel 1 goto :adv_update_apply
goto :show_advanced

:adv_update_apply
echo.
call :write_portable_event diagnostics update-apply started
python -c "from hermes_cli.main import main; main()" update
if errorlevel 1 (
    call :write_portable_event diagnostics update-apply failed
    echo.
    echo %BRIGHT_RED%[ERROR] Hermes update failed. Review the updater output and portable logs.%RESET%
    pause
    goto :show_advanced
)
call :write_portable_event diagnostics update-apply succeeded
echo.
echo %BRIGHT_GREEN%Hermes update completed. The displayed version will be refreshed.%RESET%
pause
goto :detect_status

:adv_update_check
echo.
call :write_portable_event diagnostics update-check started
powershell -NoProfile -ExecutionPolicy Bypass -File "%PORTABLE_ROOT%\scripts\invoke-hermes-observation.ps1" -Root "%PORTABLE_ROOT%" -Operation update-check
if errorlevel 1 (
    call :write_portable_event diagnostics update-check failed
    echo %BRIGHT_RED%[ERROR] Hermes update check failed. No update was applied.%RESET%
) else (
    call :write_portable_event diagnostics update-check succeeded
)
pause
goto :show_advanced

:write_portable_event
powershell -NoProfile -ExecutionPolicy Bypass -File "%PORTABLE_ROOT%\scripts\write-portable-log-event.ps1" -Root "%PORTABLE_ROOT%" -Component "%~1" -Event "%~2" -Status "%~3" >nul 2>&1
exit /b 0
