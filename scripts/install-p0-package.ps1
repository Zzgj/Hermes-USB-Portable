# Run from an extracted, SHA-256 verified P0 package. Updates shell files only.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Target, [switch]$ConfirmInstall)
$ErrorActionPreference = 'Stop'
$package = Split-Path $PSScriptRoot -Parent
$Target = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Target).TrimEnd('\', '/')
if ($Target -eq $package.TrimEnd('\', '/')) { throw 'Choose a different installation directory.' }
if ($Target -eq [IO.Path]::GetPathRoot($Target).TrimEnd('\', '/')) { throw 'A filesystem root is not an installation target.' }
if (-not (Test-Path -LiteralPath (Join-Path $Target 'launch.bat'))) { throw 'Target must be an existing Hermes Portable installation.' }
$manifest = Get-Content -LiteralPath (Join-Path $package 'package-manifest.json') -Raw | ConvertFrom-Json
if ($manifest.schema_version -ne 1 -or $manifest.candidate -ne 'p0-rc1') { throw 'Unsupported package manifest.' }
$seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($file in $manifest.files) {
    $relative = [string]$file.path
    if ($relative -notmatch '^(scripts|tests|manifests|docs)/[a-zA-Z0-9_.\-/\p{L}]+$' -and $relative -notin @('launch.bat','launch.sh','P0-Workbench.bat','README.md','.gitattributes','.gitignore')) { throw "Unapproved package path: $relative" }
    if ($relative.Split('/') -contains '..' -or -not $seen.Add($relative)) { throw 'Traversal or duplicate path in package.' }
    $inputFile = Join-Path $package $relative
    if ((Get-FileHash -LiteralPath $inputFile -Algorithm SHA256).Hash -ne $file.sha256) { throw "Package hash mismatch: $relative" }
    # Refuse links in both source and destination chains before any mutation.
    foreach ($base in @($package, $Target)) {
        $path = $base
        foreach ($segment in @('') + $relative.Split('/')) {
            if ($segment) { $path = Join-Path $path $segment }
            if ((Test-Path -LiteralPath $path) -and ((Get-Item -LiteralPath $path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Linked package/target path requires review.' }
        }
    }
}
if (@($manifest.files).Count -eq 0) { throw 'Empty package.' }
Write-Host "Install P0 RC1 shell into: $Target"
Write-Host 'Close target launchers and Hermes processes before continuing. Runtime, data and knowledge are not copied.'
if (-not $ConfirmInstall -and (Read-Host 'Type yes to install') -ne 'yes') { exit 0 }
$backup = Join-Path $Target ('logs/diagnostics/p0-package-backup-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$entries = @()
# Back up every old file before changing any installation file.
foreach ($file in $manifest.files) {
    $dest = Join-Path $Target $file.path
    $saved = Join-Path $backup $file.path
    $existed = Test-Path -LiteralPath $dest -PathType Leaf
    if ($existed) {
        New-Item -ItemType Directory -Path (Split-Path $saved -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $dest -Destination $saved
        if ((Get-FileHash $saved).Hash -ne (Get-FileHash $dest).Hash) { throw 'Backup verification failed.' }
    }
    $entries += [pscustomobject]@{ relative = $file.path; existed = $existed }
}
$entries | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $backup 'restore-manifest.json') -Encoding UTF8
$written = @()
try {
    foreach ($entry in $entries) {
        $dest = Join-Path $Target $entry.relative
        New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null
        $written += $entry
        Copy-Item -LiteralPath (Join-Path $package $entry.relative) -Destination $dest -Force
        if ((Get-FileHash $dest).Hash -ne (Get-FileHash (Join-Path $package $entry.relative)).Hash) { throw 'Installed file verification failed.' }
    }
} catch {
    foreach ($entry in $written) {
        $dest = Join-Path $Target $entry.relative
        if ($entry.existed) { Copy-Item -LiteralPath (Join-Path $backup $entry.relative) -Destination $dest -Force }
        elseif (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force }
    }
    throw
}
Write-Host "P0_PACKAGE_INSTALLED backup=$backup"
