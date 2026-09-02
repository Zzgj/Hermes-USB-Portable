[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string]$TargetDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$InitializerVersion = "0.1.0"
$LayoutVersion = "1"
$ManifestName = "portable-ai.manifest.json"
$MinimumFreeBytes = 2GB
$RecommendedFreeBytes = 4GB

function Write-ErrorMessage {
    param([string]$Message)
    [Console]::Error.WriteLine("[portable-initializer] ERROR: {0}", $Message)
}

function Convert-ToAbsolutePath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $Path))
}

function Test-IsFileSystemRoot {
    param([string]$Path)

    $pathRoot = [System.IO.Path]::GetPathRoot($Path)
    if ([string]::IsNullOrWhiteSpace($pathRoot)) {
        return $false
    }

    $trimCharacters = [char[]]@(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    $normalizedPath = $Path.TrimEnd($trimCharacters)
    $normalizedRoot = $pathRoot.TrimEnd($trimCharacters)

    if ([string]::IsNullOrEmpty($normalizedPath)) {
        $normalizedPath = $pathRoot
    }
    if ([string]::IsNullOrEmpty($normalizedRoot)) {
        $normalizedRoot = $pathRoot
    }

    return [string]::Equals(
        $normalizedPath,
        $normalizedRoot,
        [System.StringComparison]::OrdinalIgnoreCase
    )
}

function Join-PortablePath {
    param(
        [string]$Root,
        [string]$RelativePath
    )

    $result = $Root
    foreach ($segment in $RelativePath.Split('/')) {
        $result = Join-Path $result $segment
    }
    return $result
}

function Get-LinkLikePath {
    param(
        [string]$Root,
        [string]$RelativePath = ""
    )

    $pathsToInspect = New-Object System.Collections.Generic.List[string]
    $currentPath = $Root
    $pathsToInspect.Add($currentPath)
    if (-not [string]::IsNullOrEmpty($RelativePath)) {
        foreach ($segment in $RelativePath.Split('/')) {
            $currentPath = Join-Path $currentPath $segment
            $pathsToInspect.Add($currentPath)
        }
    }

    foreach ($pathToInspect in $pathsToInspect) {
        if (-not (Test-Path -LiteralPath $pathToInspect)) {
            continue
        }

        $item = Get-Item -LiteralPath $pathToInspect -Force
        $isReparsePoint = ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
        $linkTypeProperty = $item.PSObject.Properties["LinkType"]
        $hasLinkType = $null -ne $linkTypeProperty -and -not [string]::IsNullOrEmpty([string]$linkTypeProperty.Value)
        if ($isReparsePoint -or $hasLinkType) {
            return $pathToInspect
        }
    }

    return $null
}

function Write-NewUtf8File {
    param(
        [string]$Path,
        [string]$Content
    )

    $parent = Split-Path -Parent $Path
    $temporaryPath = Join-Path $parent (".{0}.tmp-{1}" -f (Split-Path -Leaf $Path), [Guid]::NewGuid().ToString("N"))
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)

    try {
        [System.IO.File]::WriteAllText($temporaryPath, $Content, $utf8WithoutBom)
        if (Test-Path -LiteralPath $Path) {
            throw "Refusing to overwrite existing file: $Path"
        }
        [System.IO.File]::Move($temporaryPath, $Path)
    }
    finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-DriveCheck {
    param([string]$Path)

    $result = [ordered]@{
        root = $null
        type = "Unknown"
        format = "Unknown"
        available_free_bytes = $null
        minimum_free_bytes = [int64]$MinimumFreeBytes
        recommended_free_bytes = [int64]$RecommendedFreeBytes
        meets_minimum = $null
        meets_recommendation = $null
        error = $null
    }

    try {
        $pathRoot = [System.IO.Path]::GetPathRoot($Path)
        $drive = New-Object System.IO.DriveInfo($pathRoot)
        $result.root = $drive.RootDirectory.FullName
        $result.type = $drive.DriveType.ToString()
        $result.format = $drive.DriveFormat
        $result.available_free_bytes = [int64]$drive.AvailableFreeSpace
        $result.meets_minimum = $drive.AvailableFreeSpace -ge $MinimumFreeBytes
        $result.meets_recommendation = $drive.AvailableFreeSpace -ge $RecommendedFreeBytes
    }
    catch {
        $result.error = $_.Exception.Message
    }

    return [pscustomobject]$result
}

$targetPath = $null
try {
    $targetPath = Convert-ToAbsolutePath -Path $TargetDirectory
}
catch {
    Write-ErrorMessage "The target path is invalid: $($_.Exception.Message)"
    exit 2
}

if (Test-IsFileSystemRoot -Path $targetPath) {
    Write-ErrorMessage "A filesystem root is not a valid target. Choose a dedicated directory such as D:\Portable-AI."
    exit 2
}

if ((Test-Path -LiteralPath $targetPath) -and -not (Test-Path -LiteralPath $targetPath -PathType Container)) {
    Write-ErrorMessage "The target exists and is not a directory: $targetPath"
    exit 2
}

$targetExistedBefore = Test-Path -LiteralPath $targetPath -PathType Container
$createdDirectories = New-Object System.Collections.Generic.List[string]
$preservedDirectories = New-Object System.Collections.Generic.List[string]
$failures = New-Object System.Collections.Generic.List[object]
$warnings = New-Object System.Collections.Generic.List[string]
$writeCheck = [ordered]@{
    status = "not_run"
    error = $null
}
$manifestAction = "not_attempted"
$manifestPath = Join-Path $targetPath $ManifestName

try {
    if (-not $targetExistedBefore) {
        New-Item -ItemType Directory -Path $targetPath -ErrorAction Stop | Out-Null
        $createdDirectories.Add(".")
    }
}
catch {
    Write-ErrorMessage "Unable to create target directory '$targetPath': $($_.Exception.Message)"
    exit 1
}

$targetLink = Get-LinkLikePath -Root $targetPath
if ($null -ne $targetLink) {
    Write-ErrorMessage "The target directory is a symbolic link or reparse point and will not be modified: $targetLink"
    exit 2
}

$standardDirectories = @(
    "launcher",
    "runtime",
    "runtime/hermes",
    "runtime/python",
    "runtime/node",
    "runtime/git",
    "data",
    "data/profiles",
    "data/sessions",
    "data/memories",
    "data/auth",
    "data/settings",
    "knowledge",
    "knowledge/ObsidianVault",
    "knowledge/ObsidianVault/00-Inbox",
    "knowledge/ObsidianVault/10-Assets",
    "knowledge/ObsidianVault/20-Procedures",
    "knowledge/ObsidianVault/30-Incidents",
    "knowledge/ObsidianVault/30-Incidents/Printers",
    "knowledge/ObsidianVault/30-Incidents/Windows",
    "knowledge/ObsidianVault/30-Incidents/Network",
    "knowledge/ObsidianVault/40-Drivers",
    "knowledge/ObsidianVault/50-Environments",
    "knowledge/ObsidianVault/90-Templates",
    "skills",
    "skills/printer",
    "skills/windows",
    "skills/network",
    "skills/office",
    "repository",
    "repository/drivers",
    "repository/tools",
    "repository/packages",
    "repository/manifests",
    "repository/quarantine",
    "proxy",
    "proxy/mihomo",
    "proxy/profiles",
    "workspace",
    "logs",
    "logs/initializer",
    "updates"
)

foreach ($relativePath in $standardDirectories) {
    $fullPath = Join-PortablePath -Root $targetPath -RelativePath $relativePath
    try {
        $linkLikePath = Get-LinkLikePath -Root $targetPath -RelativePath $relativePath
        if ($null -ne $linkLikePath) {
            throw "A symbolic link or reparse point would escape the selected directory: $linkLikePath"
        }
        if (Test-Path -LiteralPath $fullPath -PathType Container) {
            $preservedDirectories.Add($relativePath)
            continue
        }
        if (Test-Path -LiteralPath $fullPath) {
            throw "A non-directory item already exists at this path."
        }

        New-Item -ItemType Directory -Path $fullPath -ErrorAction Stop | Out-Null
        $createdDirectories.Add($relativePath)
    }
    catch {
        $failures.Add([pscustomobject][ordered]@{
            operation = "create_directory"
            path = $relativePath
            error = $_.Exception.Message
        })
    }
}

try {
    $writeProbe = Join-Path $targetPath (".portable-write-check-{0}.tmp" -f [Guid]::NewGuid().ToString("N"))
    try {
        $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($writeProbe, "portable-ai-write-check", $utf8WithoutBom)
        $writeCheck.status = "passed"
    }
    finally {
        if (Test-Path -LiteralPath $writeProbe) {
            Remove-Item -LiteralPath $writeProbe -Force -ErrorAction SilentlyContinue
        }
    }
}
catch {
    $writeCheck.status = "failed"
    $writeCheck.error = $_.Exception.Message
    $failures.Add([pscustomobject][ordered]@{
        operation = "write_check"
        path = "."
        error = $_.Exception.Message
    })
}

$driveCheck = Get-DriveCheck -Path $targetPath
if ($null -ne $driveCheck.error) {
    $warnings.Add("Drive information could not be read: $($driveCheck.error)")
}
elseif ($driveCheck.meets_minimum -eq $false) {
    $warnings.Add("Available space is below the 2 GiB minimum recommended by the project.")
}
elseif ($driveCheck.meets_recommendation -eq $false) {
    $warnings.Add("Available space is below the recommended 4 GiB.")
}

$manifestLink = Get-LinkLikePath -Root $targetPath -RelativePath $ManifestName
if ($null -ne $manifestLink) {
    $manifestAction = "failed"
    $failures.Add([pscustomobject][ordered]@{
        operation = "create_manifest"
        path = $ManifestName
        error = "The manifest path is a symbolic link or reparse point and will not be followed."
    })
}
elseif (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
    $manifestAction = "preserved"
    try {
        Get-Content -LiteralPath $manifestPath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop | Out-Null
    }
    catch {
        $warnings.Add("The existing version manifest was preserved but is not valid JSON.")
    }
}
elseif (Test-Path -LiteralPath $manifestPath) {
    $manifestAction = "failed"
    $failures.Add([pscustomobject][ordered]@{
        operation = "create_manifest"
        path = $ManifestName
        error = "A non-file item already exists at the manifest path."
    })
}
else {
    try {
        $manifest = [ordered]@{
            schema_version = 1
            layout_version = $LayoutVersion
            initializer_version = $InitializerVersion
            created_at_utc = [DateTime]::UtcNow.ToString("o")
            source_repository = "https://github.com/Zzgj/Hermes-USB-Portable"
            upstream_repository = "https://github.com/techjarves/Hermes-USB-Portable"
            components = @()
        }
        $manifestJson = $manifest | ConvertTo-Json -Depth 6
        Write-NewUtf8File -Path $manifestPath -Content ($manifestJson + [Environment]::NewLine)
        $manifestAction = "created"
    }
    catch {
        $manifestAction = "failed"
        $failures.Add([pscustomobject][ordered]@{
            operation = "create_manifest"
            path = $ManifestName
            error = $_.Exception.Message
        })
    }
}

$status = if ($failures.Count -eq 0) { "succeeded" } else { "failed" }
$report = [ordered]@{
    schema_version = 1
    initializer_version = $InitializerVersion
    status = $status
    checked_at_utc = [DateTime]::UtcNow.ToString("o")
    target = [ordered]@{
        path = $targetPath
        existed_before = $targetExistedBefore
        filesystem_root_targets_are_rejected = $true
        contains_spaces = $targetPath.Contains(" ")
        contains_non_ascii = [regex]::IsMatch($targetPath, "[^\u0000-\u007F]")
    }
    drive = $driveCheck
    write_check = $writeCheck
    directories = [ordered]@{
        created = $createdDirectories.ToArray()
        preserved = $preservedDirectories.ToArray()
    }
    manifest = [ordered]@{
        path = $ManifestName
        action = $manifestAction
    }
    warnings = $warnings.ToArray()
    failures = $failures.ToArray()
    safety = [ordered]@{
        disk_formatting_performed = $false
        runtime_downloaded = $false
        existing_files_overwritten = $false
        symbolic_links_followed = $false
        administrator_privileges_requested = $false
    }
}

$reportDirectory = Join-Path $targetPath "logs"
$reportDirectory = Join-Path $reportDirectory "initializer"
$reportName = "environment-check-{0}-{1}.json" -f [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssfffZ"), [Guid]::NewGuid().ToString("N").Substring(0, 8)
$reportPath = Join-Path $reportDirectory $reportName

try {
    $reportLink = Get-LinkLikePath -Root $targetPath -RelativePath "logs/initializer"
    if ($null -ne $reportLink) {
        throw "Refusing to write the report through a symbolic link or reparse point: $reportLink"
    }
    if (-not (Test-Path -LiteralPath $reportDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $reportDirectory -ErrorAction Stop | Out-Null
    }
    $reportJson = $report | ConvertTo-Json -Depth 10
    Write-NewUtf8File -Path $reportPath -Content ($reportJson + [Environment]::NewLine)
}
catch {
    Write-ErrorMessage "Initialization status is '$status', but the environment report could not be written: $($_.Exception.Message)"
    exit 1
}

if ($status -eq "failed") {
    Write-ErrorMessage "Initialization failed. Review: $reportPath"
    exit 1
}

[Console]::WriteLine("[portable-initializer] OK: {0}", $targetPath)
[Console]::WriteLine("[portable-initializer] Manifest: {0} ({1})", $manifestPath, $manifestAction)
[Console]::WriteLine("[portable-initializer] Environment report: {0}", $reportPath)
exit 0
