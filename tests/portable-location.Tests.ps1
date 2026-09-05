$ErrorActionPreference = 'Stop'
$setup = Get-Content "$PSScriptRoot/../scripts/setup-windows.ps1" -Raw
foreach ($name in @('baseLocationProbe','importLocationProbe')) {
    $line = @($setup -split "`n" | Where-Object { $_.StartsWith('$' + $name + ' =') })[0]
    . ([scriptblock]::Create($line))
}
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($null -eq $pythonCommand) { $pythonCommand = Get-Command python3 -ErrorAction Stop }
$python = $pythonCommand.Source
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('p0-location-tests-' + [Guid]::NewGuid().ToString('N'))
$previous = $env:PYTHONPATH
try {
    $old = Join-Path $fixture 'old'
    $new = Join-Path $fixture 'new with space'
    foreach ($root in @($old,$new)) {
        New-Item -ItemType Directory -Path "$root/hermes_cli" -Force | Out-Null
        [IO.File]::WriteAllText("$root/hermes_cli/__init__.py", '')
        [IO.File]::WriteAllText("$root/hermes_cli/main.py", '')
    }
    $env:PYTHONPATH = $old
    $ErrorActionPreference = 'Continue'
    & $python -c $importLocationProbe $new 2>$null
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -eq 0) { throw 'Old source must be rejected even when still present.' }
    $env:PYTHONPATH = $new
    & $python -c $importLocationProbe $new
    if ($LASTEXITCODE -ne 0) { throw 'Relocated source should be accepted.' }
    $ErrorActionPreference = 'Continue'
    & $python -c $baseLocationProbe $new 2>$null
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -eq 0) { throw 'Unrelated interpreter prefix must be rejected.' }
    $prefix = (& $python -c 'import sys; print(sys.base_prefix)').Trim()
    & $python -c $baseLocationProbe $prefix
    if ($LASTEXITCODE -ne 0) { throw 'Correct base prefix should be accepted.' }
    Write-Host 'Portable location tests passed.'
} finally {
    $env:PYTHONPATH = $previous
    Remove-Item -LiteralPath $fixture -Recurse -Force -ErrorAction SilentlyContinue
}
