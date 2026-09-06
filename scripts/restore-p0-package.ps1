# Restore a verified shell-install backup, never Runtime/source or user data.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Target,
    [Parameter(Mandatory=$true)][string]$Backup,
    [switch]$ConfirmRestore
)
$ErrorActionPreference = 'Stop'
$Target = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Target).TrimEnd('\','/')
$Backup = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Backup).TrimEnd('\','/')
if ($Target -eq [IO.Path]::GetPathRoot($Target).TrimEnd('\','/')) { throw 'Filesystem root refused.' }
$expectedParent = Join-Path $Target 'logs/diagnostics'
if ((Split-Path $Backup -Parent) -ne $expectedParent -or (Split-Path $Backup -Leaf) -notmatch '^p0-package-backup-[0-9a-f]{32}$') {
    throw 'Use an installation backup belonging to this target.'
}
function Assert-NoLink([string]$Path) {
    $cursor = $Path
    while ($cursor) {
        if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Linked paths require manual review.'
        }
        $parent = Split-Path $cursor -Parent
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
}
Assert-NoLink $Backup
$manifestPath = Join-Path $Backup 'restore-manifest.json'
Assert-NoLink $manifestPath
$entries = @(Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json)
if (-not $entries.Count) { throw 'Empty restore manifest.' }
$seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($entry in $entries) {
    $relative = [string]$entry.relative
    if ($relative -notmatch '^(scripts|tests|manifests|docs)/[a-zA-Z0-9_.\-/\p{L}]+$' -and $relative -notin @('launch.bat','launch.sh','P0-Workbench.bat','README.md','.gitattributes','.gitignore')) { throw 'Unapproved restore path.' }
    if ($relative.Split('/') -contains '..' -or $relative.Split('/') -contains '.' -or $relative.Contains('//') -or -not $seen.Add($relative)) { throw 'Ambiguous restore path.' }
    if ($entry.existed -isnot [bool] -or $entry.new_sha256 -notmatch '^[0-9a-fA-F]{64}$') { throw 'Invalid restore entry.' }
    $current = Join-Path $Target $relative
    $saved = Join-Path $Backup $relative
    Assert-NoLink $current
    Assert-NoLink $saved
    if (-not (Test-Path -LiteralPath $current -PathType Leaf) -or (Get-FileHash -LiteralPath $current).Hash -ne $entry.new_sha256) {
        throw "Current shell file changed since installation; refusing overwrite: $relative"
    }
    if ($entry.existed) {
        if ($entry.old_sha256 -notmatch '^[0-9a-fA-F]{64}$' -or (Get-FileHash -LiteralPath $saved).Hash -ne $entry.old_sha256) { throw 'Backup hash mismatch.' }
    }
}
if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
    $active = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
        $_.ExecutablePath -and $_.ExecutablePath.StartsWith($Target + '\', [StringComparison]::OrdinalIgnoreCase)
    })
    if ($active.Count) { throw 'Close target Hermes processes before restoring shell files.' }
}
Write-Host "Restore shell only in: $Target"
Write-Host 'Runtime, Hermes source, configuration and chat data are not restored or deleted.'
if (-not $ConfirmRestore -and (Read-Host 'Type yes to restore') -cne 'yes') { exit 0 }
$undo = Join-Path $expectedParent ('p0-shell-restore-undo-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $undo | Out-Null
foreach ($entry in $entries) {
    $copy = Join-Path $undo $entry.relative
    New-Item -ItemType Directory -Path (Split-Path $copy -Parent) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $Target $entry.relative) -Destination $copy
    if ((Get-FileHash -LiteralPath $copy).Hash -ne $entry.new_sha256) { throw 'Pre-restore backup verification failed.' }
}
$written = @()
try {
    foreach ($entry in $entries) {
        $current = Join-Path $Target $entry.relative
        if ((Get-FileHash -LiteralPath $current).Hash -ne $entry.new_sha256) { throw 'Shell changed during restore; refusing overwrite.' }
        $written += $entry
        if ($entry.existed) {
            Copy-Item -LiteralPath (Join-Path $Backup $entry.relative) -Destination $current -Force
            if ((Get-FileHash -LiteralPath $current).Hash -ne $entry.old_sha256) { throw 'Restored file verification failed.' }
        } else {
            # Recoverable: the new file was already verified and copied into undo.
            Remove-Item -LiteralPath $current
        }
    }
} catch {
    foreach ($entry in $written) {
        Copy-Item -LiteralPath (Join-Path $undo $entry.relative) -Destination (Join-Path $Target $entry.relative) -Force
    }
    throw
}
Write-Host "P0_SHELL_RESTORED undo=$undo"
Write-Host 'Files newly introduced by the package were removed from the shell; recoverable copies remain in undo.'
