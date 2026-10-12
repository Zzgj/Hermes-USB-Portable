@echo off
chcp 65001 >nul
setlocal DisableDelayedExpansion
title Hermes Portable - P2 浏览器工作台
if not exist "%~dp0.cache\runtimes\windows-x64\node\node.exe" (
    echo.
    echo [尚未初始化] 请先运行同目录的 launch.bat，完成联网初始化与模型配置。
    echo P2 工作台使用浏览器显示，本窗口负责管理本地服务。
    echo 请勿绕过公司脚本策略，也不要手工创建 ready.flag。
    pause
    exit /b 1
)
echo.
echo [准备] 正在检查并打开 P2 浏览器工作台，请保留此窗口…
powershell.exe -NoLogo -NoProfile -File "%~dp0scripts\start-p2-workbench.ps1" -Root "%~dp0." -Experimental
set "P2_EXIT=%ERRORLEVEL%"
if not "%P2_EXIT%"=="0" (
    echo.
    echo [未正常结束] 请检查上方错误；如停止尚未确认，请勿拔出 U 盘。
    echo 若被公司脚本策略阻止，请按公司流程处理，不要强制绕过。
    pause
)
exit /b %P2_EXIT%
