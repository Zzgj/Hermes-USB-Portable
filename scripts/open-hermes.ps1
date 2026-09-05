[CmdletBinding()]
param(
    [ValidateSet('CLI', 'TUI', 'Web', 'Desktop')][string]$Mode = 'CLI',
    [string]$Root = (Split-Path $PSScriptRoot -Parent),
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$Root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Root)
$source = Join-Path $Root 'src/hermes-agent'
$main = Join-Path $source 'hermes_cli/main.py'
if (-not (Test-Path -LiteralPath $main)) { throw 'Runtime/source not installed. Run launch.bat first.' }
$text = Get-Content -LiteralPath $main -Raw
$available = switch ($Mode) {
    CLI { $true }
    TUI { $text.Contains('--tui') -and (Test-Path -LiteralPath (Join-Path $source 'ui-tui/node_modules')) }
    Web { ($text.Contains('dashboard')) -and (Test-Path -LiteralPath (Join-Path $source 'hermes_cli/web_dist/index.html')) }
    Desktop { $text.Contains('desktop') -and (Test-Path -LiteralPath (Join-Path $source 'desktop/node_modules')) }
}
if ($CheckOnly) { [pscustomobject]@{ Mode = $Mode; AssetsDetected = [bool]$available }; exit 0 }
if (-not $available) { throw "$Mode entry/assets are unavailable in this Hermes installation. No automatic tool install was attempted." }
$arguments = switch ($Mode) {
    CLI { if ($text.Contains('--cli')) { '--cli' } else { 'chat' } }
    TUI { '--tui' }
    Web { 'dashboard'; '--host'; '127.0.0.1' }
    Desktop { 'desktop' }
}
& (Join-Path $Root 'launch.bat') @arguments
exit $LASTEXITCODE
