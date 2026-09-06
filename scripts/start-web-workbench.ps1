[CmdletBinding()]
param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Windows is required.' }
$Root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Root)
$launcher = Join-Path $Root 'launch.bat'
if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) { throw 'Portable launcher not found.' }
# cmd metacharacters in a root need a different quoting strategy. Fail closed.
if ($Root -match '["%&|<>^!\r\n]') { throw 'This Web controller does not support shell metacharacters in the root path.' }
$cmd = Join-Path ([Environment]::GetFolderPath('System')) 'cmd.exe'
$taskkill = Join-Path ([Environment]::GetFolderPath('System')) 'taskkill.exe'
$arguments = '/d /s /c ""' + $launcher + '" dashboard --host 127.0.0.1"'
$owned = Start-Process -FilePath $cmd -ArgumentList $arguments -WorkingDirectory $Root -PassThru
try {
    if ($owned.HasExited) { exit $owned.ExitCode }
    $started = $owned.StartTime.ToUniversalTime().Ticks
    Write-Host 'Web is starting in a separate console. Read its localhost URL and errors there.'
    Write-Host 'Closing the browser does not stop Web. Finish active chats before stopping.'
    Write-Host 'STOP terminates only the process tree started by this controller; it is a forced stop, not graceful chat finalization.'
    while (-not $owned.HasExited) {
        $answer = Read-Host 'Type STOP to stop this Web instance, or press Enter to check its status'
        if ($owned.HasExited) { break }
        if ($answer -cne 'STOP') { continue }
        # Do not act on a PID read from a stale receipt, port scan, or another instance.
        $live = Get-Process -Id $owned.Id -ErrorAction SilentlyContinue
        if ($null -eq $live -or $live.StartTime.ToUniversalTime().Ticks -ne $started) {
            throw 'Owned process identity changed. No process was terminated.'
        }
        & $taskkill /PID $owned.Id /T /F
        if ($LASTEXITCODE -ne 0) { throw 'Web stop failed. Inspect the service window before removing the drive.' }
        [void]$owned.WaitForExit(5000)
        Write-Host 'Owned Web process tree stopped. Returning to Workbench.'
        exit 0
    }
    Write-Host 'Web launcher exited. If its window reported a startup failure, preserve that output.'
    exit $owned.ExitCode
} finally {
    # An interrupted controller must never guess which unrelated processes to kill.
    $owned.Dispose()
}
