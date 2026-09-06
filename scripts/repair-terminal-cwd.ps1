[CmdletBinding()]
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [switch]$Apply)
$ErrorActionPreference = 'Stop'
$Root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Root)
$python = Join-Path $Root '.cache/runtimes/windows-x64/venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) { throw 'Run Setup before reviewing terminal cwd.' }
$arguments = @('-I', (Join-Path $PSScriptRoot 'repair-terminal-cwd.py'), '--root', $Root)
if ($Apply) { $arguments += '--apply' }
& $python @arguments
exit $LASTEXITCODE
