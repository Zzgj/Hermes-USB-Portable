[CmdletBinding()]
param(
    [string]$UpdateStatePath,
    [string]$UpdateWrapperPath,
    [string]$WindowsLauncherPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$testScriptPath = $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($testScriptPath)) {
    throw "Unable to determine the test script path."
}
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $testScriptPath)
if ([string]::IsNullOrWhiteSpace($UpdateStatePath)) {
    $UpdateStatePath = Join-Path $repositoryRoot "scripts/portable-update-state.ps1"
}
if ([string]::IsNullOrWhiteSpace($UpdateWrapperPath)) {
    $UpdateWrapperPath = Join-Path $repositoryRoot "scripts/invoke-hermes-update.ps1"
}
if ([string]::IsNullOrWhiteSpace($WindowsLauncherPath)) {
    $WindowsLauncherPath = Join-Path $repositoryRoot "launch.bat"
}

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("hermes-portable-update-state-tests-{0}" -f [Guid]::NewGuid().ToString("N"))

try {
    Assert-True (Test-Path -LiteralPath $UpdateStatePath -PathType Leaf) "portable update state helper should exist"
    Assert-True (Test-Path -LiteralPath $UpdateWrapperPath -PathType Leaf) "portable update wrapper should exist"
    . $UpdateStatePath

    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
    $markerPath = Join-Path $testRoot "latest.json"
    $missingMarker = Get-UpdateFileMarker -Path $markerPath
    Assert-True (-not $missingMarker.exists) "a missing official receipt should have a missing marker"
    [System.IO.File]::WriteAllText($markerPath, '{"schema":1}')
    $firstMarker = Get-UpdateFileMarker -Path $markerPath
    Assert-True (Test-UpdateFileMarkerChanged -Before $missingMarker -After $firstMarker) "receipt creation should be detected"
    Assert-True (-not (Test-UpdateFileMarkerChanged -Before $firstMarker -After $firstMarker)) "an unchanged receipt should not be reported as new"
    [System.IO.File]::AppendAllText($markerPath, " ")
    $secondMarker = Get-UpdateFileMarker -Path $markerPath
    Assert-True (Test-UpdateFileMarkerChanged -Before $firstMarker -After $secondMarker) "receipt content changes should be detected even on coarse filesystems"

    $officialReceiptPath = Join-Path $testRoot "official.json"
    $officialReceiptJson = @'
{
  "schema": 1,
  "outcome": "success",
  "stop_reason": "already-current",
  "argv": ["update", "--token", "must-not-copy"],
  "pre_update": {"sha": "1111111111111111111111111111111111111111", "short_sha": "11111111", "version": "0.21.0", "source": "git", "path": "private"},
  "post_update": {"sha": "2222222222222222222222222222222222222222", "short_sha": "22222222", "version": "0.22.0", "source": "git"},
  "steps": [{"detail": "private path or profile"}]
}
'@
    [System.IO.File]::WriteAllText($officialReceiptPath, $officialReceiptJson)
    $safeSummary = Get-SafeOfficialUpdateReceipt -Path $officialReceiptPath
    Assert-True ($safeSummary.outcome -eq "success") "safe summary should retain the official outcome"
    Assert-True ($safeSummary.post_update.version -eq "0.22.0") "safe summary should retain the installed version"
    $safeJson = $safeSummary | ConvertTo-Json -Depth 8
    Assert-True (-not ($safeJson -match 'must-not-copy|private path|"argv"|"steps"')) "safe summary should omit argv, step details, paths, and possible secrets"

    $officialReceiptWithoutOptionalFields = '{"schema":1,"outcome":"failed","pre_update":{},"post_update":{}}'
    [System.IO.File]::WriteAllText($officialReceiptPath, $officialReceiptWithoutOptionalFields)
    $minimalSummary = Get-SafeOfficialUpdateReceipt -Path $officialReceiptPath
    Assert-True ($minimalSummary.outcome -eq "failed" -and $null -eq $minimalSummary.stop_reason) "optional official receipt fields should be handled under strict mode"

    [System.IO.File]::WriteAllText($officialReceiptPath, '{"schema":1')
    Assert-True ($null -eq (Get-SafeOfficialUpdateReceipt -Path $officialReceiptPath)) "invalid official receipt JSON should be rejected"

    $runtimeDirectory = Join-Path $testRoot ".cache/runtimes/windows-x64"
    New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
    $manifestPath = Join-Path $runtimeDirectory "runtime-manifest.json"
    $manifest = [ordered]@{
        schema_version = 1
        platform = "windows-x64"
        component_lock_sha256 = ("a" * 64)
        hermes_commit = ("1" * 40)
        components = @([ordered]@{ id = "python"; version = "3.11" })
    }
    Write-PortableJsonAtomic -Path $manifestPath -Value $manifest
    Update-PortableRuntimeManifest -Path $manifestPath -HermesCommit ("2" * 40) -HermesVersion "0.22.0" -PortableReceiptPath "logs/diagnostics/update-apply-test.json" -UpdatedAtUtc "2026-09-04T00:00:00Z"
    $updatedManifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-True ($updatedManifest.hermes_commit -eq ("2" * 40)) "runtime manifest should record the actual updated commit"
    Assert-True ($updatedManifest.hermes_version -eq "0.22.0") "runtime manifest should record the actual updated version"
    Assert-True ($updatedManifest.hermes_update_receipt -eq "logs/diagnostics/update-apply-test.json") "runtime manifest should link the portable update receipt"
    Assert-True ($updatedManifest.components[0].id -eq "python") "runtime manifest refresh should preserve component state"
    Assert-True (@(Get-ChildItem -LiteralPath $runtimeDirectory -Filter ".*.tmp-*" -Force).Count -eq 0) "atomic manifest writes should not leave temporary files"

    $wrapperSource = Get-Content -LiteralPath $UpdateWrapperPath -Raw -Encoding UTF8
    $launcherSource = Get-Content -LiteralPath $WindowsLauncherPath -Raw -Encoding UTF8
    Assert-True ($wrapperSource -match 'venv\\Scripts\\python\.exe') "official updater should run through the portable virtual environment"
    Assert-True ($wrapperSource -match 'main\(\)" update') "wrapper should delegate mutation to the official updater"
    Assert-True (-not ($wrapperSource -match '(?:--no-backup|--yes|--force|--force-venv)')) "wrapper should not bypass official update safeguards"
    Assert-True ($wrapperSource -match '\$env:GIT_CONFIG_COUNT = "1"') "wrapper should scope the Git ownership exception to its process"
    Assert-True ($wrapperSource -match '\$env:HERMES_HOME = Join-Path \$rootPath "data"') "wrapper should force official receipts into portable data"
    Assert-True ($wrapperSource -match '\$env:PATH = \$gitDirectory \+ \[System\.IO\.Path\]::PathSeparator \+ \$env:PATH') "wrapper should expose portable Git to official updater subprocesses"
    Assert-True ($wrapperSource -match 'remote", "get-url", "origin"') "wrapper should inspect the actual official update origin"
    Assert-True ($wrapperSource -match 'does not match the reviewed Runtime component lock') "wrapper should refuse an unreviewed update origin"
    Assert-True ($wrapperSource -match 'channel = \$updateChannel') "portable receipt should record the actual configured update channel"
    Assert-True ($wrapperSource -match 'Start-Transcript -LiteralPath \$transcriptPath') "wrapper should capture the complete official update transcript"
    Assert-True ($wrapperSource -match 'status = "running"') "wrapper should persist an in-progress receipt before the official update starts"
    Assert-True ($wrapperSource -match 'Get-SafeOfficialUpdateReceipt') "wrapper should summarize the official update receipt"
    Assert-True ($wrapperSource -match 'Update-PortableRuntimeManifest') "wrapper should refresh actual Runtime version state"
    Assert-True ($wrapperSource -match 'Write-SetupReceipt.+"hermes-dependencies"') "wrapper should refresh the dependency receipt only after verification"
    Assert-True ($launcherSource -match 'invoke-hermes-update\.ps1') "Windows menu update should use the logged portable wrapper"

    Write-Host "Portable update state tests passed."
}
catch {
    $failureText = @(
        $_.Exception.Message
        $_.InvocationInfo.PositionMessage
        $_.ScriptStackTrace
    ) -join [Environment]::NewLine
    [Console]::Error.WriteLine("Portable update state tests failed:{0}{1}", [Environment]::NewLine, $failureText)
    $annotationText = $failureText.Replace("%", "%25").Replace([string][char]13, "%0D").Replace([string][char]10, "%0A")
    Write-Output "::error file=tests/portable-update-state.Tests.ps1,title=Portable update state tests failed::$annotationText"
    exit 1
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
