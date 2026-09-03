function Get-UpdateFileMarker {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return [ordered]@{
            exists = $false
            length = $null
            last_write_utc_ticks = $null
            sha256 = $null
        }
    }

    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    return [ordered]@{
        exists = $true
        length = [int64]$item.Length
        last_write_utc_ticks = [int64]$item.LastWriteTimeUtc.Ticks
        sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
    }
}

function Test-UpdateFileMarkerChanged {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        $Before,

        [Parameter(Mandatory = $true)]
        $After
    )

    if ([bool]$Before.exists -ne [bool]$After.exists) {
        return $true
    }
    if (-not [bool]$After.exists) {
        return $false
    }

    return (
        [int64]$Before.length -ne [int64]$After.length -or
        [int64]$Before.last_write_utc_ticks -ne [int64]$After.last_write_utc_ticks -or
        [string]$Before.sha256 -ne [string]$After.sha256
    )
}

function Get-OptionalPropertyValue {
    [CmdletBinding()]
    param(
        $InputObject,

        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if ($null -eq $InputObject) {
        return $null
    }
    $property = $InputObject.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }
    return $property.Value
}

function Get-SafeCodeIdentity {
    [CmdletBinding()]
    param(
        $Identity
    )

    if ($null -eq $Identity) {
        return $null
    }

    $sha = [string](Get-OptionalPropertyValue -InputObject $Identity -Name "sha")
    if ($sha -notmatch '^[0-9a-fA-F]{7,64}$') {
        $sha = $null
    }
    $shortSha = [string](Get-OptionalPropertyValue -InputObject $Identity -Name "short_sha")
    if ($shortSha -notmatch '^[0-9a-fA-F]{7,16}$') {
        $shortSha = $null
    }
    $version = [string](Get-OptionalPropertyValue -InputObject $Identity -Name "version")
    if ([string]::IsNullOrWhiteSpace($version) -or $version.Length -gt 128) {
        $version = $null
    }
    $source = [string](Get-OptionalPropertyValue -InputObject $Identity -Name "source")
    if ($source -notin @("git", "build-file", "unknown")) {
        $source = $null
    }

    return [ordered]@{
        sha = $sha
        short_sha = $shortSha
        version = $version
        source = $source
    }
}

function Get-SafeOfficialUpdateReceipt {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $null
    }

    try {
        $receipt = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
        if ((Get-OptionalPropertyValue -InputObject $receipt -Name "schema") -ne 1) {
            return $null
        }

        $outcome = [string](Get-OptionalPropertyValue -InputObject $receipt -Name "outcome")
        if ($outcome -notin @("running", "success", "partial", "failed", "refused")) {
            $outcome = $null
        }
        $stopReason = [string](Get-OptionalPropertyValue -InputObject $receipt -Name "stop_reason")
        if ([string]::IsNullOrWhiteSpace($stopReason) -or $stopReason -notmatch '^[a-zA-Z0-9_.-]{1,64}$') {
            $stopReason = $null
        }

        return [ordered]@{
            schema = 1
            outcome = $outcome
            stop_reason = $stopReason
            pre_update = Get-SafeCodeIdentity -Identity (Get-OptionalPropertyValue -InputObject $receipt -Name "pre_update")
            post_update = Get-SafeCodeIdentity -Identity (Get-OptionalPropertyValue -InputObject $receipt -Name "post_update")
        }
    }
    catch {
        return $null
    }
}

function Set-JsonNoteProperty {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        $InputObject,

        [Parameter(Mandatory = $true)]
        [string]$Name,

        $Value
    )

    $InputObject | Add-Member -MemberType NoteProperty -Name $Name -Value $Value -Force
}

function Write-PortableJsonAtomic {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        $Value,

        [ValidateRange(2, 32)]
        [int]$Depth = 12
    )

    $directory = Split-Path -Parent $Path
    if ([string]::IsNullOrWhiteSpace($directory)) {
        throw "A parent directory is required for the JSON path."
    }
    New-Item -ItemType Directory -Path $directory -Force -ErrorAction Stop | Out-Null
    $temporaryPath = Join-Path $directory (".{0}.tmp-{1}" -f (Split-Path -Leaf $Path), [Guid]::NewGuid().ToString("N"))
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)

    try {
        [System.IO.File]::WriteAllText(
            $temporaryPath,
            (($Value | ConvertTo-Json -Depth $Depth) + [Environment]::NewLine),
            $utf8WithoutBom
        )
        Move-Item -LiteralPath $temporaryPath -Destination $Path -Force -ErrorAction Stop
    }
    finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Update-PortableRuntimeManifest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [ValidatePattern('^[0-9a-fA-F]{40}$')]
        [string]$HermesCommit,

        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$HermesVersion,

        [Parameter(Mandatory = $true)]
        [ValidatePattern('^logs/diagnostics/update-apply-[^/]+\.json$')]
        [string]$PortableReceiptPath,

        [Parameter(Mandatory = $true)]
        [string]$UpdatedAtUtc
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Runtime manifest not found: $Path"
    }
    $manifest = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    if ($manifest.schema_version -ne 1 -or [string]$manifest.platform -ne "windows-x64") {
        throw "The runtime manifest has an unsupported schema or platform."
    }

    Set-JsonNoteProperty -InputObject $manifest -Name "hermes_commit" -Value $HermesCommit.ToLowerInvariant()
    Set-JsonNoteProperty -InputObject $manifest -Name "hermes_version" -Value $HermesVersion
    Set-JsonNoteProperty -InputObject $manifest -Name "hermes_updated_at_utc" -Value $UpdatedAtUtc
    Set-JsonNoteProperty -InputObject $manifest -Name "hermes_update_receipt" -Value $PortableReceiptPath
    Write-PortableJsonAtomic -Path $Path -Value $manifest -Depth 12
}
