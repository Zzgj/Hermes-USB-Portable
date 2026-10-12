@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
set "P2_HOST_APPDATA=%APPDATA%"
set "P2_HOST_LOCALAPPDATA=%LOCALAPPDATA%"
title Hermes Portable - 便携工作台
call :init_colors

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
if exist "%PORTABLE_ROOT%\updates\hermes-restore-active.json" (
    echo [错误] 检测到未完成的 Hermes 恢复，暂时不能启动或初始化。
    echo 请先核对恢复日志，再按恢复说明处理 scripts\manage-hermes-checkpoint.ps1。
    exit /b 1
)
set "PORTABLE_ROOT_GIT=%PORTABLE_ROOT:\=/%"
set "GIT_CONFIG_COUNT=2"
set "GIT_CONFIG_KEY_0=safe.directory"
set "GIT_CONFIG_VALUE_0=%PORTABLE_ROOT_GIT%/.tmp/hermes-agent-source"
set "GIT_CONFIG_KEY_1=safe.directory"
set "GIT_CONFIG_VALUE_1=%PORTABLE_ROOT_GIT%/src/hermes-agent"
call :write_portable_event launcher launcher-start started

REM ---------------------------------------------------------------------------
REM First-run setup and repair detection
REM ---------------------------------------------------------------------------
set "NEED_RUNTIME_SETUP=0"
set "RECORDED_PORTABLE_ROOT="
if exist "%RUNTIME_DIR%\portable-location.txt" set /p RECORDED_PORTABLE_ROOT=<"%RUNTIME_DIR%\portable-location.txt"
if /I not "!RECORDED_PORTABLE_ROOT!"=="%PORTABLE_ROOT%" set "NEED_RUNTIME_SETUP=1"
if not exist "%RUNTIME_DIR%\ready.flag" set "NEED_RUNTIME_SETUP=1"
if not exist "%RUNTIME_DIR%\python\python.exe" set "NEED_RUNTIME_SETUP=1"
if not exist "%RUNTIME_DIR%\node\node.exe" set "NEED_RUNTIME_SETUP=1"
if not exist "%RUNTIME_DIR%\uv\uv.exe" set "NEED_RUNTIME_SETUP=1"
if not exist "%RUNTIME_DIR%\git\cmd\git.exe" set "NEED_RUNTIME_SETUP=1"
if not exist "%RUNTIME_DIR%\git\bin\bash.exe" set "NEED_RUNTIME_SETUP=1"
if not exist "%RUNTIME_DIR%\venv\Scripts\python.exe" set "NEED_RUNTIME_SETUP=1"
if not exist "%SRC_DIR%\hermes-agent\.git" set "NEED_RUNTIME_SETUP=1"
if "!NEED_RUNTIME_SETUP!"=="1" (
    echo.
    echo %BRIGHT_CYAN%================================================================%RESET%
    echo %BOLD%%BRIGHT_WHITE%  HERMES PORTABLE  /  便携工作台%RESET%
    echo %CYAN%  第一步：准备 Windows x64 运行环境%RESET%
    echo %BRIGHT_CYAN%----------------------------------------------------------------%RESET%
    echo  首次运行或盘符变化时，需要下载组件或修复便携路径。
    echo  首次下载约 600 MB，另需安装依赖；请保持联网和 U 盘连接。
    echo  请遵守公司下载及脚本策略，不要关闭窗口或手工创建就绪标记。
    echo %BRIGHT_CYAN%================================================================%RESET%
    echo.
    call :write_portable_event setup runtime-setup started
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PORTABLE_ROOT%\scripts\setup-windows.ps1" -Root "%PORTABLE_ROOT%"
    set "SETUP_EXIT=!errorlevel!"
    if not "!SETUP_EXIT!"=="0" (
        call :write_portable_event setup runtime-setup failed
        echo.
        echo [错误] 初始化未完成，已验证的下载与已完成步骤已保留。
        echo [提示] 请检查 logs\setup，处理原因后重新运行 launch.bat。
        pause
        exit /b !SETUP_EXIT!
    )
    if not exist "%RUNTIME_DIR%\ready.flag" (
        call :write_portable_event setup runtime-setup failed
        echo.
        echo [错误] 初始化返回但未生成就绪标记，可能已取消。
        echo [提示] 请检查 logs\setup，不要手工创建 ready.flag。
        pause
        exit /b 1
    )
    call :write_portable_event setup runtime-setup succeeded
)

REM ---------------------------------------------------------------------------
REM Environment isolation - keep everything inside the portable folder
REM ---------------------------------------------------------------------------
set "VIRTUAL_ENV=%RUNTIME_DIR%\venv"
set "PORTABLE_PYTHON=%VIRTUAL_ENV%\Scripts\python.exe"
REM Seed this process only; persisted configuration/session cwd may override it.
set "TERMINAL_CWD=%SRC_DIR%\hermes-agent"
set "HERMES_GIT_BASH_PATH=%RUNTIME_DIR%\git\bin\bash.exe"
set "PATH=%VIRTUAL_ENV%\Scripts;%RUNTIME_DIR%\python;%RUNTIME_DIR%\python\Scripts;%RUNTIME_DIR%\node;%RUNTIME_DIR%\uv;%RUNTIME_DIR%\bin;%RUNTIME_DIR%\git\cmd;%RUNTIME_DIR%\git\bin;%PATH%"
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
    echo [错误] 初始化显示就绪，但 Hermes 源码缺失。
    echo [提示] 请检查初始化日志；修复时仅按说明处理 ready.flag。
    echo [提示] 不要删除 .cache，已验证下载和用户数据可继续使用。
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
    "%PORTABLE_PYTHON%" -c "from hermes_cli.main import main; main()" %ARGS%
    set "DIRECT_EXIT=!errorlevel!"
    if not "!DIRECT_EXIT!"=="0" (
        call :write_portable_event launcher direct-command failed
        exit /b !DIRECT_EXIT!
    )
    call :write_portable_event launcher direct-command succeeded
    exit /b 0
)

REM ---------------------------------------------------------------------------
REM Status Detection
REM ---------------------------------------------------------------------------
:detect_status
set "SETUP_STATUS=未检测到模型配置"
set "SETUP_ICON=[x]"
set "SETUP_COLOR=%RED%"
set "PROVIDER_NAME="
set "MODEL_NAME="
if exist "%HERMES_HOME%\.env" (
    findstr /R /C:"^[A-Z].*=" "%HERMES_HOME%\.env" >nul 2>&1
    if not errorlevel 1 (
        set "SETUP_STATUS=已检测到配置，模型连接待验证"
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

set "GATEWAY_STATUS=未运行"
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
        set "GATEWAY_STATUS=运行中 - PID !GATEWAY_PID!"
        set "GATEWAY_ICON=[OK]"
        set "GATEWAY_COLOR=%BRIGHT_GREEN%"
    ) else (
        set "GATEWAY_STATUS=未运行 - 存在过期记录"
        set "GATEWAY_ICON=[!]"
        set "GATEWAY_COLOR=%YELLOW%"
    )
)

set "HERMES_VERSION=未知"
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
title Hermes Portable - 便携工作台
echo %BRIGHT_CYAN%================================================================%RESET%
echo %BOLD%%BRIGHT_WHITE%  HERMES PORTABLE  /  便携工作台%RESET%
echo %CYAN%  本机运行 · U 盘便携 · P2-S1 开发测试版%RESET%
echo %BRIGHT_CYAN%================================================================%RESET%
echo.
echo  %BOLD%运行概况%RESET%
echo  模型配置  !SETUP_COLOR!!SETUP_ICON!%RESET% %WHITE%!SETUP_STATUS!%RESET%
if defined PROVIDER_NAME echo  服务提供  %CYAN%!PROVIDER_NAME!%RESET%
if defined MODEL_NAME echo  当前模型  %WHITE%!MODEL_NAME!%RESET%
echo  原生网关  !GATEWAY_COLOR!!GATEWAY_ICON!%RESET% %WHITE%!GATEWAY_STATUS!%RESET%
echo  内核版本  %GRAY%!HERMES_VERSION!%RESET%
echo.
echo %BRIGHT_CYAN%----------------------------------------------------------------%RESET%
echo.
echo  %BG_CYAN% [P] 打开 P2 工作台 %RESET%  %CYAN%浏览器界面 · 推荐入口%RESET%
echo  %BRIGHT_YELLOW%[2]%RESET%  %WHITE%配置模型与 Hermes%RESET%    %GRAY%首次使用请先配置%RESET%
echo.
echo  %BRIGHT_YELLOW%[1]%RESET%  %WHITE%原生命令行聊天%RESET%
if "!GATEWAY_STATUS!"=="运行中 - PID !GATEWAY_PID!" (
    echo  %BRIGHT_YELLOW%[3]%RESET%  %WHITE%停止原生网关%RESET%  %RED%[运行中]%RESET%
) else (
    echo  %BRIGHT_YELLOW%[3]%RESET%  %WHITE%启动原生网关%RESET%
)
echo  %BRIGHT_YELLOW%[4]%RESET%  %WHITE%高级工具%RESET%              %GRAY%诊断 / 日志 / 更新%RESET%
echo  %BRIGHT_YELLOW%[5]%RESET%  %WHITE%安全退出菜单%RESET%
echo.
echo %BRIGHT_CYAN%----------------------------------------------------------------%RESET%
echo  %YELLOW%关闭浏览器不会停止服务。P2 控制台中输入 0 或 EXIT 退出。%RESET%
echo  %GRAY%原生网关与 P2 服务相互独立，拔盘前需分别确认已停止。%RESET%
echo.

echo %BRIGHT_CYAN%请选择按键：%RESET% & choice /C 12345P /N
if errorlevel 6 goto :menu_p2
if errorlevel 5 goto :menu_exit
if errorlevel 4 goto :show_advanced
if errorlevel 3 goto :menu_gateway
if errorlevel 2 goto :menu_setup
if errorlevel 1 goto :menu_chat
goto :show_menu

REM ---------------------------------------------------------------------------
REM Menu Actions
REM ---------------------------------------------------------------------------
:menu_p2
if not exist "%PORTABLE_ROOT%\P2-Workbench.bat" (
    echo %BRIGHT_RED%[提示] 当前目录没有 P2 启动入口，请使用包含 P2 的完整测试包。%RESET%
    pause
    goto :show_menu
)
REM The default browser must retain its normal host profile directories.
setlocal
set "APPDATA=%P2_HOST_APPDATA%"
set "LOCALAPPDATA=%P2_HOST_LOCALAPPDATA%"
call "%PORTABLE_ROOT%\P2-Workbench.bat"
endlocal
goto :detect_status

:menu_chat
echo.
call :write_portable_event launcher chat started
"%PORTABLE_PYTHON%" -c "from hermes_cli.main import main; main()"
if errorlevel 1 (
    call :write_portable_event launcher chat failed
) else (
    call :write_portable_event launcher chat succeeded
)
goto :show_menu

:menu_setup
echo.
call :write_portable_event launcher hermes-setup started
"%PORTABLE_PYTHON%" -c "from hermes_cli.main import main; main()" setup
if errorlevel 1 (
    call :write_portable_event launcher hermes-setup failed
) else (
    call :write_portable_event launcher hermes-setup succeeded
)
goto :detect_status

:menu_gateway
if "!GATEWAY_STATUS!"=="运行中 - PID !GATEWAY_PID!" (
    call :write_portable_event launcher gateway-stop started
    "%PORTABLE_PYTHON%" -c "from hermes_cli.main import main; main()" gateway stop
    if errorlevel 1 (
        call :write_portable_event launcher gateway-stop failed
    ) else (
        call :write_portable_event launcher gateway-stop succeeded
    )
    echo.
    echo %CYAN%网关停止命令已返回，请核对上方结果和刷新后的状态。%RESET%
) else (
    echo.
    echo %CYAN%正在请求后台启动原生网关，请稍候…%RESET%
    call :write_portable_event launcher gateway-start started
    start "" "%PORTABLE_PYTHON%" -c "from hermes_cli.main import main; main()" gateway
    call :write_portable_event launcher gateway-start observed
    timeout /t 2 /nobreak >nul
)
pause
goto :detect_status

:menu_exit
call :write_portable_event launcher launcher-exit observed
echo.
echo.
echo %CYAN%启动菜单已退出。%RESET%
echo %YELLOW%这不会停止其他窗口的服务；确认所有相关服务已停止后再拔盘。%RESET%
echo.
exit /b

REM ---------------------------------------------------------------------------
REM Advanced Menu
REM ---------------------------------------------------------------------------
:show_advanced
echo.
echo.
echo %BRIGHT_CYAN%----------------------------------------------------------------%RESET%
echo %BOLD%%BRIGHT_WHITE%  高级工具  /  诊断与维护%RESET%
echo %BRIGHT_CYAN%----------------------------------------------------------------%RESET%
echo.
echo  %BRIGHT_YELLOW%[1]%RESET%  %WHITE%环境诊断%RESET%      %GRAY%检查配置与运行环境%RESET%
echo  %BRIGHT_YELLOW%[2]%RESET%  %WHITE%查看日志%RESET%      %GRAY%日志位置与网关末尾记录%RESET%
echo  %BRIGHT_YELLOW%[3]%RESET%  %WHITE%编辑配置%RESET%      %GRAY%调用原生配置编辑器%RESET%
echo  %BRIGHT_YELLOW%[4]%RESET%  %WHITE%重启原生网关%RESET%
echo  %BRIGHT_YELLOW%[5]%RESET%  %WHITE%检查更新%RESET%      %GRAY%只读检查，不安装%RESET%
echo  %BRIGHT_YELLOW%[6]%RESET%  %YELLOW%更新 Hermes%RESET%   %GRAY%先审阅计划，再确认安装%RESET%
echo  %BRIGHT_YELLOW%[7]%RESET%  %CYAN%返回主菜单%RESET%
echo.
echo %BRIGHT_CYAN%----------------------------------------------------------------%RESET%
echo.

echo %BRIGHT_CYAN%请选择按键：%RESET% & choice /C 1234567 /N
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
echo %CYAN%工作台日志：%RESET% %LOG_ROOT%
echo %CYAN%Hermes 日志：%RESET% %HERMES_HOME%\logs
echo %CYAN%日志索引：%RESET%   %PORTABLE_ROOT%\manifests\log-sources.json
echo.
if exist "%HERMES_HOME%\logs\gateway.log" (
    echo %CYAN%=== 原生网关日志 - 最后 20 行 ===%RESET%
    powershell -Command "Get-Content '%HERMES_HOME%\logs\gateway.log' -Tail 20"
) else (
    echo %YELLOW%暂未找到网关日志。%RESET%
)
echo.
pause
goto :show_advanced

:adv_config
echo.
"%PORTABLE_PYTHON%" -c "from hermes_cli.main import main; main()" config edit
goto :show_advanced

:adv_restart
"%PORTABLE_PYTHON%" -c "from hermes_cli.main import main; main()" gateway restart
echo.
echo %CYAN%网关重启命令已返回，请核对上方结果和刷新后的状态。%RESET%
pause
goto :detect_status

:adv_update
echo.
echo %CYAN%正在读取 Hermes 官方更新计划…%RESET%
powershell -NoProfile -ExecutionPolicy Bypass -File "%PORTABLE_ROOT%\scripts\invoke-hermes-observation.ps1" -Root "%PORTABLE_ROOT%" -Operation update-plan
if errorlevel 1 (
    call :write_portable_event diagnostics update-plan failed
    echo.
    echo %BRIGHT_RED%[错误] 更新计划读取失败，未执行更新。%RESET%
    pause
    goto :show_advanced
)
call :write_portable_event diagnostics update-plan succeeded
echo.
echo 更新前会保存并校验运行环境与源码备份。
echo 此操作需要额外磁盘空间与时间，请先关闭该实例的其他进程。
choice /C YN /N /M "确认从 origin/main 执行官方更新？[Y 确认 / N 取消] "
if errorlevel 2 (
    call :write_portable_event diagnostics update-apply cancelled
    goto :show_advanced
)
if errorlevel 1 goto :adv_update_apply
goto :show_advanced

:adv_update_apply
echo.
call :write_portable_event diagnostics update-apply started
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PORTABLE_ROOT%\scripts\invoke-hermes-update.ps1" -Root "%PORTABLE_ROOT%"
if errorlevel 1 (
    call :write_portable_event diagnostics update-apply failed
    echo.
    echo %BRIGHT_RED%[错误] Hermes 更新或便携状态记录未完成。%RESET%
    echo %BRIGHT_RED%[提示] 请查看 logs\diagnostics 和 data\logs\update_receipts。%RESET%
    pause
    goto :show_advanced
)
call :write_portable_event diagnostics update-apply succeeded
echo.
echo %BRIGHT_GREEN%Hermes 更新完成，即将刷新版本信息。%RESET%
pause
goto :detect_status

:adv_update_check
echo.
call :write_portable_event diagnostics update-check started
powershell -NoProfile -ExecutionPolicy Bypass -File "%PORTABLE_ROOT%\scripts\invoke-hermes-observation.ps1" -Root "%PORTABLE_ROOT%" -Operation update-check
if errorlevel 1 (
    call :write_portable_event diagnostics update-check failed
    echo %BRIGHT_RED%[错误] Hermes 更新检查失败，未执行更新。%RESET%
) else (
    call :write_portable_event diagnostics update-check succeeded
)
pause
goto :show_advanced

:write_portable_event
powershell -NoProfile -ExecutionPolicy Bypass -File "%PORTABLE_ROOT%\scripts\write-portable-log-event.ps1" -Root "%PORTABLE_ROOT%" -Component "%~1" -Event "%~2" -Status "%~3" >nul 2>&1
exit /b 0

:init_colors
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
if defined NO_COLOR for %%v in (RESET BOLD DIM CYAN BRIGHT_CYAN GREEN BRIGHT_GREEN YELLOW BRIGHT_YELLOW RED BRIGHT_RED WHITE BRIGHT_WHITE GRAY BG_CYAN) do set "%%v="
exit /b 0
