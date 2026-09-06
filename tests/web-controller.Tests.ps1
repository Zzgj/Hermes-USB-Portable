$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    Write-Host 'Web process ownership tests skipped: Windows required.'
    exit 0
}
$root = Join-Path ([IO.Path]::GetTempPath()) ('web controller tests-' + [Guid]::NewGuid().ToString('N'))
$hostExe = (Get-Process -Id $PID).Path
$cmd = Join-Path ([Environment]::GetFolderPath('System')) 'cmd.exe'
$unrelated = $null
try {
    New-Item -ItemType Directory -Path $root | Out-Null
    # No actual server, credentials, or installed runtime is needed.
    [IO.File]::WriteAllText("$root/launch.bat", "@echo off`r`nping -n 15 127.0.0.1 >nul`r`nexit /b 23`r`n", [Text.Encoding]::ASCII)
    $unrelated = Start-Process $cmd -ArgumentList '/d /c ping -n 30 127.0.0.1 >nul' -PassThru -WindowStyle Hidden
    'STOP' | & $hostExe -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot/../scripts/start-web-workbench.ps1" -Root $root
    if ($LASTEXITCODE -ne 0) { throw 'Explicit STOP must terminate the owned launcher, not wait for its exit 23.' }
    if ($unrelated.HasExited) { throw 'Unrelated process must not be terminated.' }
    Write-Host 'Web process ownership tests passed.'
} finally {
    if ($null -ne $unrelated) {
        if (-not $unrelated.HasExited) {
            & (Join-Path ([Environment]::GetFolderPath('System')) 'taskkill.exe') /PID $unrelated.Id /T /F | Out-Null
        }
        $unrelated.Dispose()
    }
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
