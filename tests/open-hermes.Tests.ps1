$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    Write-Host 'Entrypoint command forwarding tests skipped: Windows required.'
    exit 0
}
function Assert($Value, $Message) { if (-not $Value) { throw $Message } }
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('entry tests-' + [char]0x6D4B + [Guid]::NewGuid().ToString('N'))
$hostExe = (Get-Process -Id $PID).Path
$opener = Join-Path $PSScriptRoot '../scripts/open-hermes.ps1'
try {
    New-Item -ItemType Directory -Path "$fixture/src/hermes-agent/hermes_cli/web_dist", "$fixture/src/hermes-agent/ui-tui/node_modules" -Force | Out-Null
    $main = "$fixture/src/hermes-agent/hermes_cli/main.py"
    [IO.File]::WriteAllText($main, '--cli --tui dashboard desktop')
    [IO.File]::WriteAllText("$fixture/src/hermes-agent/hermes_cli/web_dist/index.html", 'fixture')
    $batch = "@echo off`r`n> `"%~dp0args.txt`" echo %*`r`nexit /b 23`r`n"
    [IO.File]::WriteAllText("$fixture/launch.bat", $batch, [Text.Encoding]::ASCII)
    foreach ($case in @(@('CLI','--cli'), @('TUI','--tui'), @('Web','dashboard --host 127.0.0.1'))) {
        & $hostExe -NoProfile -ExecutionPolicy Bypass -File $opener -Root $fixture -Mode $case[0] -ForegroundWeb
        Assert ($LASTEXITCODE -eq 23) 'Launcher exit code must propagate'
        $actual = [IO.File]::ReadAllText("$fixture/args.txt").Trim()
        Assert ($actual -eq $case[1]) "Argument boundary changed: expected $($case[1]), actual $actual"
    }
    [IO.File]::WriteAllText($main, 'legacy chat dashboard desktop --tui')
    & $hostExe -NoProfile -ExecutionPolicy Bypass -File $opener -Root $fixture -Mode CLI
    Assert ($LASTEXITCODE -eq 23) 'Legacy launcher exit code must propagate'
    Assert ([IO.File]::ReadAllText("$fixture/args.txt").Trim() -eq 'chat') 'Legacy single command must stay intact'
    Remove-Item -LiteralPath "$fixture/args.txt"
    & $hostExe -NoProfile -ExecutionPolicy Bypass -File $opener -Root $fixture -Mode Desktop
    Assert ($LASTEXITCODE -eq 2) 'Missing optional desktop should have a distinct exit code'
    Assert (-not (Test-Path "$fixture/args.txt")) 'Missing desktop must not launch anything'
    & $hostExe -NoProfile -ExecutionPolicy Bypass -File $opener -Root $fixture -Mode Web -CheckOnly
    Assert ($LASTEXITCODE -eq 0) 'CheckOnly should succeed'
    Assert (-not (Test-Path "$fixture/args.txt")) 'CheckOnly must not launch anything'
    Write-Host 'Hermes entrypoint forwarding tests passed.'
} finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force -ErrorAction SilentlyContinue
}
