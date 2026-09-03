function Invoke-DirectoryMoveWithRetry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,

        [Parameter(Mandatory = $true)]
        [string]$Destination,

        [ValidateRange(1, 10)]
        [int]$Attempts = 6,

        [ValidateRange(1, 30000)]
        [int]$InitialDelayMilliseconds = 500,

        [scriptblock]$MoveOperation
    )

    if ($null -eq $MoveOperation) {
        $MoveOperation = {
            param($MoveSource, $MoveDestination)
            Move-Item -LiteralPath $MoveSource -Destination $MoveDestination -ErrorAction Stop
        }
    }

    $lastException = $null
    $delayMilliseconds = $InitialDelayMilliseconds
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $null = & $MoveOperation $Source $Destination
            if (-not (Test-Path -LiteralPath $Destination -PathType Container)) {
                throw "The move operation returned without creating the destination directory."
            }
            return [pscustomobject]@{
                succeeded = $true
                attempts = $attempt
                error = $null
                exception_type = $null
                hresult = $null
            }
        }
        catch {
            $lastException = $_.Exception
            if ($attempt -lt $Attempts) {
                Write-Host (
                    "[WARN]  Directory move attempt {0}/{1} failed: {2}. Retrying in {3} ms ..." -f
                    $attempt,
                    $Attempts,
                    $lastException.Message,
                    $delayMilliseconds
                ) -ForegroundColor Yellow
                Start-Sleep -Milliseconds $delayMilliseconds
                $delayMilliseconds = [Math]::Min($delayMilliseconds * 2, 8000)
            }
        }
    }

    return [pscustomobject]@{
        succeeded = $false
        attempts = $Attempts
        error = $lastException.Message
        exception_type = $lastException.GetType().FullName
        hresult = $lastException.HResult
    }
}

function Copy-StagedDirectory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,

        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    if (Test-Path -LiteralPath $Destination) {
        throw "Copy fallback destination already exists: $Destination"
    }

    New-Item -ItemType Directory -Path $Destination -ErrorAction Stop | Out-Null
    $sourceItems = @(Get-ChildItem -LiteralPath $Source -Force -ErrorAction Stop)
    foreach ($sourceItem in $sourceItems) {
        Copy-Item -LiteralPath $sourceItem.FullName -Destination $Destination -Recurse -Force -ErrorAction Stop
    }

    $trimCharacters = [char[]]@(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    $sourceRoot = [System.IO.Path]::GetFullPath($Source).TrimEnd($trimCharacters)
    $sourceFiles = @(Get-ChildItem -LiteralPath $Source -Recurse -Force -File -ErrorAction Stop)
    $destinationFiles = @(Get-ChildItem -LiteralPath $Destination -Recurse -Force -File -ErrorAction Stop)
    if ($sourceFiles.Count -ne $destinationFiles.Count) {
        throw "Copy fallback file-count mismatch: source=$($sourceFiles.Count), destination=$($destinationFiles.Count)"
    }

    foreach ($sourceFile in $sourceFiles) {
        $relativePath = $sourceFile.FullName.Substring($sourceRoot.Length).TrimStart($trimCharacters)
        $destinationFile = Join-Path $Destination $relativePath
        if (-not (Test-Path -LiteralPath $destinationFile -PathType Leaf)) {
            throw "Copy fallback omitted a staged file: $relativePath"
        }
        if ((Get-Item -LiteralPath $destinationFile -Force).Length -ne $sourceFile.Length) {
            throw "Copy fallback size mismatch for staged file: $relativePath"
        }
        $sourceHash = (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256 -ErrorAction Stop).Hash
        $destinationHash = (Get-FileHash -LiteralPath $destinationFile -Algorithm SHA256 -ErrorAction Stop).Hash
        if (-not [string]::Equals($sourceHash, $destinationHash, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Copy fallback SHA-256 mismatch for staged file: $relativePath"
        }
    }
}

function Install-StagedDirectory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,

        [Parameter(Mandatory = $true)]
        [string]$Destination,

        [ValidateRange(1, 10)]
        [int]$MoveAttempts = 6,

        [ValidateRange(1, 30000)]
        [int]$InitialDelayMilliseconds = 500,

        [scriptblock]$MoveOperation
    )

    if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
        throw "Staged source directory not found: $Source"
    }
    if ((Test-Path -LiteralPath $Destination) -and -not (Test-Path -LiteralPath $Destination -PathType Container)) {
        throw "Destination exists and is not a directory: $Destination"
    }

    $sourcePath = [System.IO.Path]::GetFullPath($Source)
    $destinationPath = [System.IO.Path]::GetFullPath($Destination)
    if ([string]::Equals($sourcePath, $destinationPath, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Staged source and destination directories must be different."
    }

    $destinationParent = Split-Path -Parent $destinationPath
    if ([string]::IsNullOrWhiteSpace($destinationParent)) {
        throw "Unable to determine destination parent: $destinationPath"
    }
    New-Item -ItemType Directory -Path $destinationParent -Force -ErrorAction Stop | Out-Null

    $retryArguments = @{
        Attempts = $MoveAttempts
        InitialDelayMilliseconds = $InitialDelayMilliseconds
        MoveOperation = $MoveOperation
    }
    $backupPath = $destinationPath + ".backup-" + [Guid]::NewGuid().ToString("N")
    $hadExisting = Test-Path -LiteralPath $destinationPath -PathType Container
    if ($hadExisting) {
        $backupMove = Invoke-DirectoryMoveWithRetry -Source $destinationPath -Destination $backupPath @retryArguments
        if (-not $backupMove.succeeded) {
            $backupError = "Unable to preserve the existing runtime directory after {0} attempts. Source: {1}; destination: {2}; error: {3}; type: {4}; HRESULT: {5}" -f
                $backupMove.attempts,
                $destinationPath,
                $backupPath,
                $backupMove.error,
                $backupMove.exception_type,
                $backupMove.hresult
            throw $backupError
        }
    }

    try {
        $installMove = Invoke-DirectoryMoveWithRetry -Source $sourcePath -Destination $destinationPath @retryArguments
        if (-not $installMove.succeeded) {
            $moveWarning = "[WARN]  Directory move failed after {0} attempts; using copy fallback. Source: {1}; destination: {2}; error: {3}; type: {4}; HRESULT: {5}" -f
                $installMove.attempts,
                $sourcePath,
                $destinationPath,
                $installMove.error,
                $installMove.exception_type,
                $installMove.hresult
            Write-Host $moveWarning -ForegroundColor Yellow
            Copy-StagedDirectory -Source $sourcePath -Destination $destinationPath
            Write-Host "[WARN]  Copy fallback completed and verified; staged source is retained until final cleanup." -ForegroundColor Yellow
        }

        if (-not (Test-Path -LiteralPath $destinationPath -PathType Container)) {
            throw "Runtime destination was not created: $destinationPath"
        }

        if ($hadExisting -and (Test-Path -LiteralPath $backupPath)) {
            try {
                Remove-Item -LiteralPath $backupPath -Recurse -Force -ErrorAction Stop
            }
            catch {
                Write-Host "[WARN]  Installed runtime is ready, but the previous backup could not be removed: $backupPath" -ForegroundColor Yellow
            }
        }
    }
    catch {
        $installError = $_.Exception.Message
        if (Test-Path -LiteralPath $destinationPath) {
            Remove-Item -LiteralPath $destinationPath -Recurse -Force -ErrorAction SilentlyContinue
        }

        if ($hadExisting -and (Test-Path -LiteralPath $backupPath)) {
            $restoreMove = Invoke-DirectoryMoveWithRetry -Source $backupPath -Destination $destinationPath @retryArguments
            if (-not $restoreMove.succeeded) {
                $rollbackError = "Runtime install failed and rollback also failed. Install error: {0}; backup: {1}; restore error: {2}; HRESULT: {3}" -f
                    $installError,
                    $backupPath,
                    $restoreMove.error,
                    $restoreMove.hresult
                throw $rollbackError
            }
        }

        throw "Runtime staged-directory install failed: $installError"
    }
}
