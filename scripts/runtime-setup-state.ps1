function Get-SetupReceiptPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$StateDirectory,

        [Parameter(Mandatory = $true)]
        [ValidatePattern('^[a-z0-9][a-z0-9-]*$')]
        [string]$StepId
    )

    return Join-Path $StateDirectory ("{0}.json" -f $StepId)
}

function Test-SetupReceipt {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$StateDirectory,

        [Parameter(Mandatory = $true)]
        [ValidatePattern('^[a-z0-9][a-z0-9-]*$')]
        [string]$StepId,

        [Parameter(Mandatory = $true)]
        [string]$Fingerprint
    )

    $receiptPath = Get-SetupReceiptPath -StateDirectory $StateDirectory -StepId $StepId
    if (-not (Test-Path -LiteralPath $receiptPath -PathType Leaf)) {
        return $false
    }

    try {
        $receipt = Get-Content -LiteralPath $receiptPath -Raw -Encoding UTF8 | ConvertFrom-Json
        return (
            $receipt.schema_version -eq 1 -and
            [string]$receipt.step_id -eq $StepId -and
            [string]$receipt.fingerprint -eq $Fingerprint -and
            [string]$receipt.status -eq "succeeded"
        )
    }
    catch {
        return $false
    }
}

function Test-SetupVerification {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Verification
    )

    try {
        $verificationOutput = @(& $Verification)
        return (
            $verificationOutput.Count -eq 1 -and
            $verificationOutput[0] -is [bool] -and
            $verificationOutput[0] -eq $true
        )
    }
    catch {
        return $false
    }
}

function Test-SetupStepReady {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$StateDirectory,

        [Parameter(Mandatory = $true)]
        [ValidatePattern('^[a-z0-9][a-z0-9-]*$')]
        [string]$StepId,

        [Parameter(Mandatory = $true)]
        [string]$Fingerprint,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Verification
    )

    if (-not (Test-SetupReceipt -StateDirectory $StateDirectory -StepId $StepId -Fingerprint $Fingerprint)) {
        return $false
    }
    if (Test-SetupVerification -Verification $Verification) {
        return $true
    }

    Remove-SetupReceipt -StateDirectory $StateDirectory -StepId $StepId
    return $false
}

function Write-SetupReceipt {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$StateDirectory,

        [Parameter(Mandatory = $true)]
        [ValidatePattern('^[a-z0-9][a-z0-9-]*$')]
        [string]$StepId,

        [Parameter(Mandatory = $true)]
        [string]$Fingerprint,

        [hashtable]$Details = @{}
    )

    New-Item -ItemType Directory -Path $StateDirectory -Force -ErrorAction Stop | Out-Null
    $receiptPath = Get-SetupReceiptPath -StateDirectory $StateDirectory -StepId $StepId
    $temporaryPath = Join-Path $StateDirectory (".{0}.tmp-{1}" -f $StepId, [Guid]::NewGuid().ToString("N"))
    $receipt = [ordered]@{
        schema_version = 1
        step_id = $StepId
        fingerprint = $Fingerprint
        status = "succeeded"
        verified_at_utc = [DateTime]::UtcNow.ToString("o")
        details = $Details
    }
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)

    try {
        [System.IO.File]::WriteAllText(
            $temporaryPath,
            (($receipt | ConvertTo-Json -Depth 8) + [Environment]::NewLine),
            $utf8WithoutBom
        )
        Move-Item -LiteralPath $temporaryPath -Destination $receiptPath -Force -ErrorAction Stop
    }
    finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
        }
    }

    return $receiptPath
}

function Remove-SetupReceipt {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$StateDirectory,

        [Parameter(Mandatory = $true)]
        [ValidatePattern('^[a-z0-9][a-z0-9-]*$')]
        [string]$StepId
    )

    $receiptPath = Get-SetupReceiptPath -StateDirectory $StateDirectory -StepId $StepId
    if (Test-Path -LiteralPath $receiptPath) {
        Remove-Item -LiteralPath $receiptPath -Force -ErrorAction SilentlyContinue
    }
}

function Get-HermesSourceStatePath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$RuntimeDirectory
    )

    return Join-Path $RuntimeDirectory "hermes-source.json"
}

function Test-HermesSourceStateFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [ValidatePattern('^[0-9a-fA-F]{64}$')]
        [string]$ExpectedComponentLockHash,

        [ValidatePattern('^$|^[0-9a-fA-F]{40}$')]
        [string]$ExpectedCommit = ""
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $false
    }

    try {
        $sourceState = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
        return (
            $sourceState.schema_version -eq 1 -and
            [string]$sourceState.commit -match '^[0-9a-fA-F]{40}$' -and
            ([string]::IsNullOrWhiteSpace($ExpectedCommit) -or [string]$sourceState.commit -eq $ExpectedCommit) -and
            [string]$sourceState.component_lock_sha256 -eq $ExpectedComponentLockHash.ToLowerInvariant() -and
            $sourceState.update_policy.allow_newer_than_bootstrap -eq $true
        )
    }
    catch {
        return $false
    }
}

function Write-HermesSourceState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$RuntimeDirectory,

        [Parameter(Mandatory = $true)]
        [object]$SourceState
    )

    New-Item -ItemType Directory -Path $RuntimeDirectory -Force -ErrorAction Stop | Out-Null
    $sourceStatePath = Get-HermesSourceStatePath -RuntimeDirectory $RuntimeDirectory
    $temporaryPath = Join-Path $RuntimeDirectory (".hermes-source.tmp-{0}" -f [Guid]::NewGuid().ToString("N"))
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)

    try {
        [System.IO.File]::WriteAllText(
            $temporaryPath,
            (($SourceState | ConvertTo-Json -Depth 8) + [Environment]::NewLine),
            $utf8WithoutBom
        )
        Move-Item -LiteralPath $temporaryPath -Destination $sourceStatePath -Force -ErrorAction Stop
    }
    finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
        }
    }

    return $sourceStatePath
}

function Move-LegacyHermesSourceState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceDirectory,

        [Parameter(Mandatory = $true)]
        [string]$RuntimeDirectory,

        [Parameter(Mandatory = $true)]
        [ValidatePattern('^[0-9a-fA-F]{64}$')]
        [string]$ExpectedComponentLockHash
    )

    $sourceStatePath = Get-HermesSourceStatePath -RuntimeDirectory $RuntimeDirectory
    $legacySourceStatePath = Join-Path $SourceDirectory ".portable-source.json"
    $canonicalStateValid = Test-HermesSourceStateFile -Path $sourceStatePath -ExpectedComponentLockHash $ExpectedComponentLockHash

    if (-not (Test-Path -LiteralPath $legacySourceStatePath -PathType Leaf)) {
        return $canonicalStateValid
    }

    if (-not $canonicalStateValid) {
        if (-not (Test-HermesSourceStateFile -Path $legacySourceStatePath -ExpectedComponentLockHash $ExpectedComponentLockHash)) {
            return $false
        }
        $legacySourceState = Get-Content -LiteralPath $legacySourceStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
        Write-HermesSourceState -RuntimeDirectory $RuntimeDirectory -SourceState $legacySourceState | Out-Null
        $canonicalStateValid = $true
    }

    # This exact legacy file was generated by older Portable setup versions.
    # Remove it only after a valid canonical Runtime-owned copy exists.
    Remove-Item -LiteralPath $legacySourceStatePath -Force -ErrorAction Stop
    return $canonicalStateValid
}

function Set-HermesCaseCollisionWorkaround {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$GitExecutable,

        [Parameter(Mandatory = $true)]
        [string]$SourceDirectory
    )

    $upperPath = "contributors/emails/agent@Agents-Mac-mini.local"
    $lowerPath = "contributors/emails/agent@agents-Mac-mini.local"
    $trackedFiles = @(
        & $GitExecutable -c core.quotepath=false -C $SourceDirectory ls-files -- $upperPath $lowerPath
    )
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect the Hermes case-collision paths."
    }

    $upperTracked = @($trackedFiles | Where-Object { [string]::Equals([string]$_, $upperPath, [StringComparison]::Ordinal) }).Count -eq 1
    $lowerTracked = @($trackedFiles | Where-Object { [string]::Equals([string]$_, $lowerPath, [StringComparison]::Ordinal) }).Count -eq 1

    if ($upperTracked -and $lowerTracked) {
        & $GitExecutable -C $SourceDirectory update-index --skip-worktree -- $upperPath $lowerPath
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to apply the bounded Hermes case-collision workaround."
        }
        return $true
    }

    # If upstream removes either colliding path, clear the local workaround on
    # any survivor so future legitimate upstream changes remain visible.
    foreach ($trackedPath in @($upperPath, $lowerPath)) {
        if (@($trackedFiles | Where-Object { [string]::Equals([string]$_, $trackedPath, [StringComparison]::Ordinal) }).Count -eq 1) {
            & $GitExecutable -C $SourceDirectory update-index --no-skip-worktree -- $trackedPath
            if ($LASTEXITCODE -ne 0) {
                throw "Unable to retire the Hermes case-collision workaround for '$trackedPath'."
            }
        }
    }

    return $false
}
