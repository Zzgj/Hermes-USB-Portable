[CmdletBinding()]
param(
    [ValidateSet('CLI', 'TUI', 'Web', 'Desktop')][string]$Mode = 'CLI',
    [string]$Root = (Split-Path $PSScriptRoot -Parent),
    [switch]$CheckOnly,
    [switch]$ForegroundWeb
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
. (Join-Path $PSScriptRoot 'interface-capabilities.ps1')
$interfaces = Get-PortableInterfaceCapabilities $Root
if ($Mode -in @('TUI', 'Web', 'Desktop') -and $interfaces.WorkspaceLinksUnsupported) {
    Write-Warning 'This filesystem cannot support the workspace links required by this entrypoint. Use NTFS; no installation was attempted.'
    exit 2
}
if (-not $available) {
    Write-Host "$Mode entry/assets are unavailable in this Hermes installation. No automatic tool install was attempted." -ForegroundColor Yellow
    exit 2
}
if ($Mode -eq 'Web' -and -not $ForegroundWeb) {
    & (Join-Path $PSScriptRoot 'start-web-workbench.ps1') -Root $Root
    exit $LASTEXITCODE
}
# Scalar string splatting expands '--cli' into individual characters. Preserve
# an array even when the selected entrypoint requires exactly one argument.
$arguments = @(switch ($Mode) {
    CLI { if ($text.Contains('--cli')) { '--cli' } else { 'chat' } }
    TUI { '--tui' }
    Web { 'dashboard'; '--host'; '127.0.0.1' }
    Desktop { 'desktop' }
})
& (Join-Path $Root 'launch.bat') @arguments
exit $LASTEXITCODE
