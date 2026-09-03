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
