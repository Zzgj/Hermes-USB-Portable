[CmdletBinding()]
param(
    [ValidateSet('Create','Restore','Undo')][string]$Mode = 'Create',
    [string]$Root = (Split-Path $PSScriptRoot -Parent),
    [string]$CheckpointId,
    [switch]$ConfirmOperation
)
$ErrorActionPreference = 'Stop'
$Root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Root).TrimEnd('\','/')
. (Join-Path $PSScriptRoot 'hermes-restore-state.ps1')
Assert-RecoveryBoundary $Root
if (-not (Test-Path -LiteralPath (Join-Path $Root 'launch.bat') -PathType Leaf)) { throw 'Not a portable instance.' }
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Managed recovery requires Windows.' }
$active = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
    $_.ExecutablePath -and $_.ExecutablePath.StartsWith($Root + '\', [StringComparison]::OrdinalIgnoreCase)
})
if ($active.Count) { throw 'Close all instance processes before creating or restoring a checkpoint.' }
Write-Host "$Mode managed Runtime and Hermes source only. User data is not rolled back."
Write-Host 'Checkpoints and displaced trees are retained privately; this operation needs additional disk space.'
if (-not $ConfirmOperation -and (Read-Host 'Type yes to continue') -cne 'yes') { exit 0 }
$marker = Join-Path $Root 'updates/hermes-restore-active.json'
if ($Mode -eq 'Undo') { Undo-HermesRestore $Root; Write-Host 'HERMES_RESTORE_UNDONE'; exit 0 }
if (Test-Path -LiteralPath $marker) { throw 'Interrupted restore detected. Use Mode Undo first.' }
$python = Join-Path $Root '.cache/runtimes/windows-x64/python/python.exe'
$helper = Join-Path $PSScriptRoot 'hermes-checkpoint.py'
if ($Mode -eq 'Create') {
    & $python -I $helper create --root $Root
    exit $LASTEXITCODE
}
if ($CheckpointId -notmatch '^[0-9a-f]{32}$') { throw 'Supply the exact checkpoint ID.' }
$checkpoint = Join-Path $Root ('updates/hermes-checkpoints/' + $CheckpointId)
$transactionId = [Guid]::NewGuid().ToString('N')
$transaction = Join-Path $Root ('updates/hermes-restores/' + $transactionId)
& $python -I $helper prepare --root $Root --checkpoint $checkpoint --transaction $transaction
if ($LASTEXITCODE -ne 0) { throw 'Restore staging failed. Live files were not swapped.' }
# Python has exited before moving its own installation directory on Windows.
Install-HermesRestore $Root $transactionId
Write-Host "HERMES_RESTORE_COMPLETED transaction=$transactionId"
Write-Host 'Displaced Runtime/source remain in updates/hermes-restores. Run diagnostics before resuming work.'
