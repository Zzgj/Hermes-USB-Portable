[CmdletBinding()]
param([string]$Root = (Split-Path $PSScriptRoot -Parent), [switch]$Experimental)
$ErrorActionPreference = 'Stop'
if (-not $Experimental) { throw 'P2 is not release-qualified. Pass -Experimental only for the documented test instance.' }
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Windows is required.' }
$Root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Root)
$node = Join-Path $Root '.cache/runtimes/windows-x64/node/node.exe'
$entry = Join-Path $Root 'workbench/scripts/launch-managed.mjs'
foreach ($file in @($node, $entry)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing P2 runtime/entry: $file" }
}
& $node $entry --root $Root --experimental
exit $LASTEXITCODE
