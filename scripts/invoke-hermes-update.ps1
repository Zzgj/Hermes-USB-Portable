[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Root
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    throw "Unable to determine the update wrapper path."
}
$scriptDirectory = Split-Path -Parent $scriptPath
. (Join-Path $scriptDirectory "portable-update-state.ps1")
. (Join-Path $scriptDirectory "runtime-setup-state.ps1")

function Get-SingleNativeOutput {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Executable,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = @(& $Executable @Arguments 2>$null)
    if ($LASTEXITCODE -ne 0 -or $output.Count -ne 1) {
        return $null
    }
    return ([string]$output[0]).Trim()
}

function Get-HermesCommit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$GitExecutable,

        [Parameter(Mandatory = $true)]
        [string]$SourceDirectory
    )

    $commit = Get-SingleNativeOutput -Executable $GitExecutable -Arguments @("-C", $SourceDirectory, "rev-parse", "HEAD")
    if ($commit -notmatch '^[0-9a-fA-F]{40}$') {
        return $null
    }
    return $commit.ToLowerInvariant()
}

function Get-HermesVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExecutable,

        [Parameter(Mandatory = $true)]
        [string]$SourceDirectory
    )

    $versionCode = "import pathlib,tomllib; print(tomllib.loads((pathlib.Path.cwd()/'pyproject.toml').read_text(encoding='utf-8'))['project']['version'])"
    Push-Location $SourceDirectory
    try {
        $version = Get-SingleNativeOutput -Executable $PythonExecutable -Arguments @("-c", $versionCode)
    }
    finally {
        Pop-Location
    }
    if ([string]::IsNullOrWhiteSpace($version) -or $version.Length -gt 128) {
        return $null
    }
    return $version
}

function Test-HermesImport {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExecutable,

        [Parameter(Mandatory = $true)]
        [string]$SourceDirectory
    )

    Push-Location $SourceDirectory
    try {
        & $PythonExecutable -c "import hermes_cli.main" *> $null
        return ($LASTEXITCODE -eq 0)
    }
    finally {
        Pop-Location
    }
}

$rootPath = [System.IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
$runtimeDirectory = Join-Path $rootPath ".cache\runtimes\windows-x64"
$basePython = Join-Path $runtimeDirectory "python\python.exe"
$venvPython = Join-Path $runtimeDirectory "venv\Scripts\python.exe"
$gitDirectory = Join-Path $runtimeDirectory "git\cmd"
$gitExecutable = Join-Path $gitDirectory "git.exe"
$runtimeManifestPath = Join-Path $runtimeDirectory "runtime-manifest.json"
$stateDirectory = Join-Path $runtimeDirectory "state"
$sourceDirectory = Join-Path $rootPath "src\hermes-agent"
$componentLockPath = Join-Path $rootPath "manifests\runtime-components.windows-x64.json"
$officialReceiptPath = Join-Path $rootPath "data\logs\update_receipts\latest.json"
$diagnosticsDirectory = Join-Path $rootPath "logs\diagnostics"

foreach ($requiredFile in @($basePython, $venvPython, $gitExecutable, $runtimeManifestPath, $componentLockPath)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required portable Runtime file not found: $requiredFile"
    }
}
if (-not (Test-Path -LiteralPath $sourceDirectory -PathType Container)) {
    throw "Hermes source directory not found: $sourceDirectory"
}

New-Item -ItemType Directory -Path $diagnosticsDirectory -Force -ErrorAction Stop | Out-Null
$stamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
$suffix = [Guid]::NewGuid().ToString("N").Substring(0, 8)
$filePrefix = "update-apply-{0}-{1}" -f $stamp, $suffix
$transcriptPath = Join-Path $diagnosticsDirectory ($filePrefix + ".log")
$portableReceiptPath = Join-Path $diagnosticsDirectory ($filePrefix + ".json")
$portableReceiptRelativePath = "logs/diagnostics/{0}.json" -f $filePrefix
$startedAtUtc = [DateTime]::UtcNow.ToString("o")
$warnings = New-Object System.Collections.Generic.List[string]
$officialExitCode = 1
$wrapperExitCode = 1
$transcriptStarted = $false
$preCommit = $null
$preVersion = $null
$postCommit = $null
$postVersion = $null
$manifestAction = "not-updated"
$receiptWritten = $false
$receiptFinalized = $false
$updateChannel = $null
$officialOriginVerified = $false

# Keep Git's ownership exception process-scoped and limited to the managed checkout.
$env:GIT_CONFIG_COUNT = "1"
$env:GIT_CONFIG_KEY_0 = "safe.directory"
$env:GIT_CONFIG_VALUE_0 = $sourceDirectory.Replace("\", "/")
$env:HERMES_HOME = Join-Path $rootPath "data"
$env:PYTHONNOUSERSITE = "1"
$env:PYTHONHOME = ""
$env:PATH = $gitDirectory + [System.IO.Path]::PathSeparator + $env:PATH

$officialMarkerBefore = Get-UpdateFileMarker -Path $officialReceiptPath

try {
    Start-Transcript -LiteralPath $transcriptPath -Force | Out-Null
    $transcriptStarted = $true
    $preCommit = Get-HermesCommit -GitExecutable $gitExecutable -SourceDirectory $sourceDirectory
    $preVersion = Get-HermesVersion -PythonExecutable $basePython -SourceDirectory $sourceDirectory
    if ($null -eq $preCommit -or $null -eq $preVersion) {
        throw "Unable to record the installed Hermes version before update."
    }

    $componentLock = Get-Content -LiteralPath $componentLockPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $hermesComponent = @($componentLock.components | Where-Object { $_.id -eq "hermes-agent" })
    if ($hermesComponent.Count -ne 1) {
        throw "The Runtime component lock must contain exactly one Hermes component."
    }
    $expectedOrigin = [string]$hermesComponent[0].source.url
    $defaultChannel = [string]$hermesComponent[0].update_policy.default_channel
    if ([string]::IsNullOrWhiteSpace($expectedOrigin) -or $defaultChannel -notmatch '^[a-zA-Z0-9._/-]+$') {
        throw "The Hermes update source policy is invalid."
    }
    $actualOrigin = Get-SingleNativeOutput -Executable $gitExecutable -Arguments @("-C", $sourceDirectory, "remote", "get-url", "origin")
    if ($actualOrigin -ne $expectedOrigin) {
        throw "The managed Hermes origin does not match the reviewed Runtime component lock."
    }
    $officialOriginVerified = $true
    $updateChannel = "origin/{0}" -f $defaultChannel

    $pendingReceipt = [ordered]@{
        schema_version = 1
        operation = "hermes-update"
        status = "running"
        started_at_utc = $startedAtUtc
        finished_at_utc = $null
        official_exit_code = $null
        wrapper_exit_code = $null
        channel = $updateChannel
        official_origin_verified = $officialOriginVerified
        transcript = "logs/diagnostics/{0}.log" -f $filePrefix
        source = [ordered]@{
            pre_update = [ordered]@{ commit = $preCommit; version = $preVersion }
            post_update = $null
            commit_changed = $null
        }
        official_receipt = [ordered]@{
            path = "data/logs/update_receipts/latest.json"
            new_receipt_observed = $false
            safe_summary = $null
        }
        runtime_manifest = [ordered]@{
            path = ".cache/runtimes/windows-x64/runtime-manifest.json"
            action = "not-updated"
        }
        warnings = @()
        safety = [ordered]@{
            official_updater_authoritative = $true
            safety_bypass_arguments_forwarded = $false
            raw_configuration_recorded = $false
            credentials_recorded = $false
            user_data_modified_by_wrapper = $false
        }
    }
    Write-PortableJsonAtomic -Path $portableReceiptPath -Value $pendingReceipt -Depth 12
    $receiptWritten = $true

    Write-Host "[portable-update] Delegating to the official Hermes updater."
    Write-Host "[portable-update] No safety-bypass arguments are being forwarded."
    Push-Location $sourceDirectory
    try {
        & $venvPython -c "from hermes_cli.main import main; main()" update
        if ($null -eq $LASTEXITCODE) {
            $officialExitCode = 0
        }
        else {
            $officialExitCode = [int]$LASTEXITCODE
        }
    }
    finally {
        Pop-Location
    }
}
catch {
    [Console]::Error.WriteLine("[portable-update] Update invocation failed: {0}", $_.Exception.Message)
    $warnings.Add("update-invocation-failed")
    $officialExitCode = 1
}
finally {
    if ($transcriptStarted) {
        try {
            Stop-Transcript | Out-Null
        }
        catch {
            [Console]::Error.WriteLine("[portable-update] Unable to close transcript: {0}", $_.Exception.Message)
            $warnings.Add("transcript-close-failed")
        }
    }
}

try {
    $postCommit = Get-HermesCommit -GitExecutable $gitExecutable -SourceDirectory $sourceDirectory
    $postVersion = Get-HermesVersion -PythonExecutable $basePython -SourceDirectory $sourceDirectory
    if ($null -eq $postCommit -or $null -eq $postVersion) {
        $warnings.Add("post-update-identity-unavailable")
    }
}
catch {
    $warnings.Add("post-update-identity-unavailable")
}

$officialMarkerAfter = Get-UpdateFileMarker -Path $officialReceiptPath
$officialReceiptObserved = Test-UpdateFileMarkerChanged -Before $officialMarkerBefore -After $officialMarkerAfter
$officialReceipt = Get-SafeOfficialUpdateReceipt -Path $officialReceiptPath
if (-not $officialReceiptObserved) {
    $warnings.Add("new-official-receipt-not-observed")
}
elseif ($null -eq $officialReceipt) {
    $warnings.Add("official-receipt-invalid")
}

$portableStateHealthy = $true
if ($officialExitCode -eq 0) {
    if ($null -eq $postCommit -or $null -eq $postVersion) {
        $portableStateHealthy = $false
    }
    elseif (-not (Test-HermesImport -PythonExecutable $venvPython -SourceDirectory $sourceDirectory)) {
        $warnings.Add("post-update-import-failed")
        $portableStateHealthy = $false
    }
    else {
        try {
            $runtimeManifest = Get-Content -LiteralPath $runtimeManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $componentLockHash = [string]$runtimeManifest.component_lock_sha256
            if ($componentLockHash -notmatch '^[0-9a-fA-F]{64}$') {
                throw "The Runtime component lock hash is missing or invalid."
            }
            $details = @{
                refreshed_after_official_update = $true
                hermes_commit = $postCommit
            }
            Write-SetupReceipt -StateDirectory $stateDirectory -StepId "hermes-source" -Fingerprint $postCommit -Details $details | Out-Null
            Write-SetupReceipt -StateDirectory $stateDirectory -StepId "hermes-dependencies" -Fingerprint ("{0}:{1}" -f $componentLockHash.ToLowerInvariant(), $postCommit) -Details $details | Out-Null
            Update-PortableRuntimeManifest -Path $runtimeManifestPath -HermesCommit $postCommit -HermesVersion $postVersion -PortableReceiptPath $portableReceiptRelativePath -UpdatedAtUtc ([DateTime]::UtcNow.ToString("o"))
            $manifestAction = "updated"
        }
        catch {
            [Console]::Error.WriteLine("[portable-update] Official update finished, but portable state refresh failed: {0}", $_.Exception.Message)
            $warnings.Add("portable-state-refresh-failed")
            $portableStateHealthy = $false
        }
    }
}

if ($officialExitCode -ne 0) {
    $status = "failed"
    $wrapperExitCode = $officialExitCode
}
elseif (-not $portableStateHealthy -or $warnings.Contains("transcript-close-failed")) {
    $status = "partial"
    $wrapperExitCode = 1
}
else {
    $status = "succeeded"
    $wrapperExitCode = 0
}

$portableReceipt = [ordered]@{
    schema_version = 1
    operation = "hermes-update"
    status = $status
    started_at_utc = $startedAtUtc
    finished_at_utc = [DateTime]::UtcNow.ToString("o")
    official_exit_code = $officialExitCode
    wrapper_exit_code = $wrapperExitCode
    channel = $updateChannel
    official_origin_verified = $officialOriginVerified
    transcript = "logs/diagnostics/{0}.log" -f $filePrefix
    source = [ordered]@{
        pre_update = [ordered]@{ commit = $preCommit; version = $preVersion }
        post_update = [ordered]@{ commit = $postCommit; version = $postVersion }
        commit_changed = ($null -ne $preCommit -and $null -ne $postCommit -and $preCommit -ne $postCommit)
    }
    official_receipt = [ordered]@{
        path = "data/logs/update_receipts/latest.json"
        new_receipt_observed = $officialReceiptObserved
        safe_summary = $officialReceipt
    }
    runtime_manifest = [ordered]@{
        path = ".cache/runtimes/windows-x64/runtime-manifest.json"
        action = $manifestAction
    }
    warnings = @($warnings)
    safety = [ordered]@{
        official_updater_authoritative = $true
        safety_bypass_arguments_forwarded = $false
        raw_configuration_recorded = $false
        credentials_recorded = $false
        user_data_modified_by_wrapper = $false
    }
}

try {
    Write-PortableJsonAtomic -Path $portableReceiptPath -Value $portableReceipt -Depth 12
    $receiptWritten = $true
    $receiptFinalized = $true
}
catch {
    [Console]::Error.WriteLine("[portable-update] Unable to write portable update receipt: {0}", $_.Exception.Message)
    $wrapperExitCode = 1
}

[Console]::WriteLine("[portable-log] Update transcript: {0}", $transcriptPath)
if ($receiptWritten) {
    if ($receiptFinalized) {
        [Console]::WriteLine("[portable-log] Update receipt: {0}", $portableReceiptPath)
    }
    else {
        [Console]::WriteLine("[portable-log] Update receipt (incomplete): {0}", $portableReceiptPath)
    }
}
exit $wrapperExitCode
