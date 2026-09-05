# Deliberate destructive acceptance test for the one disposable P0 sandbox.
# Never invoke this against a daily-use installation.
[CmdletBinding()]
param([switch]$ExecuteReset)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $ExecuteReset) {
    throw 'Pass -ExecuteReset to delete the fixed disposable sandbox runtime and source.'
}
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'Windows is required.'
}
$sandbox = 'E:\HermesPortable-P0-10-Sandbox-20260904-231542'
$resetScript = "$sandbox\scripts\reset-windows.ps1"
$expected = 'e0d05bd4e3fa19d7457334411fc561173d5190af3795cf9bfdf648a048c63b74'
if ((Get-FileHash -LiteralPath $resetScript -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
    throw 'Reset script hash mismatch.'
}
foreach ($relative in @('.cache\runtimes', 'src\hermes-agent', 'data', 'knowledge', 'logs')) {
    if (-not (Test-Path -LiteralPath "$sandbox\$relative" -PathType Container)) {
        throw "Missing acceptance directory: $relative"
    }
}

# Walk one level at a time: refuse junctions before descending into them.
$pending = New-Object 'System.Collections.Generic.Queue[string]'
$pending.Enqueue($sandbox)
while ($pending.Count -gt 0) {
    $directory = $pending.Dequeue()
    $item = Get-Item -LiteralPath $directory -Force
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        throw "Reparse point requires review: $directory"
    }
    foreach ($child in @(Get-ChildItem -LiteralPath $directory -Force)) {
        if ($child.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            throw "Reparse point requires review: $($child.FullName)"
        }
        if ($child.PSIsContainer) { $pending.Enqueue($child.FullName) }
    }
}
if (Test-Path -LiteralPath "$sandbox\data\auth.lock") {
    throw 'Sandbox auth.lock exists; inspect Gateway state first.'
}
$active = @(Get-CimInstance Win32_Process | Where-Object {
    $_.ExecutablePath -and $_.ExecutablePath.StartsWith($sandbox + '\', [StringComparison]::OrdinalIgnoreCase)
})
if ($active.Count -gt 0) { throw 'Close running sandbox programs before resetting.' }

$evidence = 'E:\HermesPortable-P0-SoftReset-Evidence-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
New-Item -ItemType Directory -Path $evidence | Out-Null
$before = @(
    foreach ($folder in @('data', 'knowledge', 'logs')) {
        foreach ($file in @(Get-ChildItem -LiteralPath "$sandbox\$folder" -Recurse -File -Force)) {
            [pscustomobject]@{
                RelativePath = $file.FullName.Substring($sandbox.Length + 1)
                SHA256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
            }
        }
    }
)
if ($before.Count -eq 0) { throw 'No user-content files found for preservation checks.' }
$before | Export-Csv -LiteralPath "$evidence\before.csv" -NoTypeInformation -Encoding UTF8
Write-Host "Evidence: $evidence"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $resetScript -Mode soft -ConfirmReset
$resetExit = $LASTEXITCODE
$changed = @(
    foreach ($file in $before) {
        $path = Join-Path $sandbox $file.RelativePath
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            $file.RelativePath
        } elseif ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $file.SHA256) {
            $file.RelativePath
        }
    }
)
$checks = [ordered]@{
    ResetSucceeded = ($resetExit -eq 0)
    RuntimeRemoved = (-not (Test-Path -LiteralPath "$sandbox\.cache\runtimes"))
    HermesSourceRemoved = (-not (Test-Path -LiteralPath "$sandbox\src\hermes-agent"))
    PreservedFilesUnchanged = ($changed.Count -eq 0)
    DataDirectoryPreserved = (Test-Path -LiteralPath "$sandbox\data")
    KnowledgeDirectoryPreserved = (Test-Path -LiteralPath "$sandbox\knowledge")
    LogsDirectoryPreserved = (Test-Path -LiteralPath "$sandbox\logs")
}
[ordered]@{
    Sandbox = $sandbox
    CheckedFiles = $before.Count
    ChangedOrMissingFiles = $changed
    Checks = $checks
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$evidence\result.json" -Encoding UTF8
[pscustomobject]$checks | Format-List
Write-Host "Evidence: $evidence"
if (@($checks.Values | Where-Object { -not $_ }).Count -gt 0) {
    throw 'Soft Reset acceptance failed; preserve the evidence.'
}
Write-Host 'P0_SOFT_RESET_PRESERVATION_OK'
