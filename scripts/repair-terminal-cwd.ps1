[CmdletBinding()]
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [switch]$Apply, [switch]$Sessions)
$ErrorActionPreference = 'Stop'
$Root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Root)
if ($Apply -and [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
    $active = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
        $_.ExecutablePath -and $_.ExecutablePath.StartsWith($Root.TrimEnd('\','/') + '\', [StringComparison]::OrdinalIgnoreCase)
    })
    if ($active.Count) { throw 'Close instance chats and services before repairing cwd.' }
}
$python = Join-Path $Root '.cache/runtimes/windows-x64/venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) { throw 'Run Setup before reviewing terminal cwd.' }
$arguments = @('-I', (Join-Path $PSScriptRoot 'repair-terminal-cwd.py'), '--root', $Root)
if ($Apply) { $arguments += '--apply' }
if ($Sessions) { $arguments += '--sessions' }
& $python @arguments
exit $LASTEXITCODE
