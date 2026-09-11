[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Target, [switch]$Experimental, [switch]$VerifyOnly, [switch]$Recover)
$ErrorActionPreference = 'Stop'
$package = Split-Path $PSScriptRoot -Parent
$Target = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Target)
$node = Join-Path $Target '.cache/runtimes/windows-x64/node/node.exe'
$installer = Join-Path $package 'workbench/scripts/install-p2-package.mjs'
if (-not (Test-Path -LiteralPath $node -PathType Leaf)) { throw 'Existing portable Node is required.' }
if ($Recover) {
    & $node $installer --recover-verify $Target
    if ($LASTEXITCODE -ne 0) { throw 'Recovery verification failed. Preserve the target, marker and backup.' }
    if ($VerifyOnly) { exit 0 }
    if (-not $Experimental) { throw 'Recovery requires -Experimental for this development snapshot.' }
    Write-Host "P2 recovery target: $Target"
    Write-Host 'Close ALL target Workbench/Hermes processes first. Restore only the interrupted P2 shell installation; retain backups.'
    if ((Read-Host 'Type RECOVER to restore the backed-up P2 shell') -cne 'RECOVER') { exit 0 }
    & $node $installer --recover-apply $Target
    exit $LASTEXITCODE
}
& $node $installer $package $Target --verify
if ($LASTEXITCODE -ne 0) { throw 'P2 package verification failed. Nothing installed.' }
if ($VerifyOnly) { exit 0 }
if (-not $Experimental) { throw 'Development snapshot requires -Experimental. Not release-qualified.' }
Write-Host "P2 shell target: $Target"
Write-Host 'Close ALL target Workbench/Hermes processes first. This is a development snapshot, not a release.'
if ((Read-Host 'Type INSTALL to back up and update P2 shell files') -cne 'INSTALL') { exit 0 }
& $node $installer $package $Target --apply-experimental
exit $LASTEXITCODE
