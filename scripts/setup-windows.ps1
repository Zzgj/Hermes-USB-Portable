# ============================================================================
# Hermes Portable - Windows Runtime Setup
# ============================================================================
# Downloads and installs portable Python, Node.js, uv, ripgrep, Git,
# clones Hermes source, creates venv, and installs dependencies.
# ============================================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$Root
)

$ErrorActionPreference = "Stop"

$RuntimeFilesystemScript = Join-Path $PSScriptRoot "runtime-filesystem.ps1"
if (-not (Test-Path -LiteralPath $RuntimeFilesystemScript -PathType Leaf)) {
    throw "Runtime filesystem helper not found: $RuntimeFilesystemScript"
}
. $RuntimeFilesystemScript

$RuntimeSetupStateScript = Join-Path $PSScriptRoot "runtime-setup-state.ps1"
if (-not (Test-Path -LiteralPath $RuntimeSetupStateScript -PathType Leaf)) {
    throw "Runtime setup state helper not found: $RuntimeSetupStateScript"
}
. $RuntimeSetupStateScript

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
$CacheDir   = Join-Path $Root ".cache"
$RuntimeDir = Join-Path $CacheDir "runtimes\windows-x64"
$SrcDir     = Join-Path $Root "src"
$BinDir     = Join-Path $RuntimeDir "bin"
$StateDir   = Join-Path $RuntimeDir "state"
$TempDir    = Join-Path $Root ".tmp"
$SetupLogDir = Join-Path (Join-Path $Root "logs") "setup"

# Git 2.35.2+ rejects repositories on filesystems such as exFAT that cannot
# report ownership. Trust only the two repositories managed by this setup,
# and only in this process and its child processes. Do not modify host-global
# Git configuration and do not use an unrestricted wildcard trust value.
$GitSafeStagingDirectory = [System.IO.Path]::GetFullPath((Join-Path $TempDir "hermes-agent-source")).Replace("\", "/")
$GitSafeInstalledDirectory = [System.IO.Path]::GetFullPath((Join-Path $SrcDir "hermes-agent")).Replace("\", "/")
$env:GIT_CONFIG_COUNT = "2"
$env:GIT_CONFIG_KEY_0 = "safe.directory"
$env:GIT_CONFIG_VALUE_0 = $GitSafeStagingDirectory
$env:GIT_CONFIG_KEY_1 = "safe.directory"
$env:GIT_CONFIG_VALUE_1 = $GitSafeInstalledDirectory

New-Item -ItemType Directory -Force -Path $SetupLogDir | Out-Null
$setupLogStamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
$setupLogSuffix = [Guid]::NewGuid().ToString("N").Substring(0, 8)
$SetupLogPath = Join-Path $SetupLogDir ("setup-{0}-{1}.log" -f $setupLogStamp, $setupLogSuffix)
$SetupTranscriptStarted = $false
$SetupSucceeded = $false
$SetupFailure = $null
try {
    Start-Transcript -LiteralPath $SetupLogPath -Force | Out-Null
    $SetupTranscriptStarted = $true
}
catch {
    Write-Warning "Unable to start the setup transcript: $($_.Exception.Message)"
}

try {

# ---------------------------------------------------------------------------
# Locked runtime components
# ---------------------------------------------------------------------------
$ComponentLockPath = Join-Path $Root "manifests\runtime-components.windows-x64.json"
if (-not (Test-Path -LiteralPath $ComponentLockPath -PathType Leaf)) {
    throw "Runtime component lock not found: $ComponentLockPath"
}
$ComponentLock = Get-Content -LiteralPath $ComponentLockPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($ComponentLock.schema_version -ne 1 -or $ComponentLock.platform -ne "windows-x64") {
    throw "Unsupported runtime component lock: $ComponentLockPath"
}
if (@($ComponentLock.components).Count -ne 6) {
    throw "The runtime component lock must contain exactly six supported components: $ComponentLockPath"
}
$ComponentLockHash = (Get-FileHash -LiteralPath $ComponentLockPath -Algorithm SHA256).Hash.ToLowerInvariant()

function Get-LockedComponent($Id) {
    $matches = @($ComponentLock.components | Where-Object { $_.id -eq $Id })
    if ($matches.Count -ne 1) {
        throw "Expected exactly one '$Id' component in $ComponentLockPath"
    }
    return $matches[0]
}

function Assert-LockedComponent($Component, $ExpectedSourceType) {
    if ([string]::IsNullOrWhiteSpace([string]$Component.version)) {
        throw "Locked component '$($Component.id)' is missing its version"
    }
    if ($Component.source.type -ne $ExpectedSourceType) {
        throw "Locked component '$($Component.id)' must use source type '$ExpectedSourceType'"
    }
    if ([string]$Component.source.url -notmatch '^https://') {
        throw "Locked component '$($Component.id)' must use an HTTPS source URL"
    }

    if ($ExpectedSourceType -eq "archive") {
        if ([int64]$Component.source.size_bytes -le 0) {
            throw "Locked component '$($Component.id)' has an invalid archive size"
        }
        if ([string]$Component.integrity.sha256 -notmatch '^[0-9a-fA-F]{64}$') {
            throw "Locked component '$($Component.id)' has an invalid SHA-256"
        }
    }
    elseif ($ExpectedSourceType -eq "git") {
        if ([string]::IsNullOrWhiteSpace([string]$Component.source.ref)) {
            throw "Locked component '$($Component.id)' is missing its Git ref"
        }
        if ([string]$Component.source.commit -notmatch '^[0-9a-fA-F]{40}$') {
            throw "Locked component '$($Component.id)' has an invalid Git commit"
        }
    }
}

$PythonComponent = Get-LockedComponent "python"
$NodeComponent = Get-LockedComponent "node"
$UvComponent = Get-LockedComponent "uv"
$RgComponent = Get-LockedComponent "ripgrep"
$GitComponent = Get-LockedComponent "portablegit"
$HermesComponent = Get-LockedComponent "hermes-agent"

foreach ($archiveComponent in @($PythonComponent, $NodeComponent, $UvComponent, $RgComponent, $GitComponent)) {
    Assert-LockedComponent $archiveComponent "archive"
}
Assert-LockedComponent $HermesComponent "git"
if ($HermesComponent.version_role -ne "bootstrap") {
    throw "The Hermes component version must be a bootstrap baseline"
}
if ($HermesComponent.update_policy.mode -ne "user_initiated" -or $HermesComponent.update_policy.allow_newer_than_bootstrap -ne $true) {
    throw "The Hermes component must permit explicit user-initiated updates beyond the bootstrap version"
}
if ($HermesComponent.update_policy.official_command -ne "hermes update" -or $HermesComponent.update_policy.default_channel -ne "main") {
    throw "The Hermes update policy must preserve the official main-channel updater"
}
if ($HermesComponent.update_policy.check_before_apply -ne $true -or $HermesComponent.update_policy.plan_before_apply -ne $true) {
    throw "The Hermes update policy must require check and plan preflight steps"
}

$AnthropicRequirement = @($ComponentLock.supplemental_python_packages | Where-Object { $_.requirement -like "anthropic==*" } | Select-Object -ExpandProperty requirement)
$TelegramRequirement = @($ComponentLock.supplemental_python_packages | Where-Object { $_.requirement -like "python-telegram-bot*" } | Select-Object -ExpandProperty requirement)
if (@($ComponentLock.supplemental_python_packages).Count -ne 2 -or $AnthropicRequirement.Count -ne 1 -or $TelegramRequirement.Count -ne 1) {
    throw "Supplemental Python package pins are incomplete in $ComponentLockPath"
}
$AnthropicRequirement = $AnthropicRequirement[0]
$TelegramRequirement = $TelegramRequirement[0]
if ($AnthropicRequirement -notmatch '^anthropic==[^\s=]+$' -or $TelegramRequirement -notmatch '^python-telegram-bot\[webhooks\]==[^\s=]+$') {
    throw "Supplemental Python packages must use exact version pins in $ComponentLockPath"
}

New-Item -ItemType Directory -Force -Path $RuntimeDir, $SrcDir, $BinDir, $StateDir, $TempDir | Out-Null

# Clean up macOS metadata junk files (._*) only inside setup-managed directories.
# User-owned data and knowledge directories are deliberately outside this scope.
Get-ChildItem -Path $CacheDir, $SrcDir, $TempDir -Filter "._*" -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Write-Step($msg) {
    Write-Host ""
    Write-Host "[SETUP] $msg" -ForegroundColor Cyan
}

function Write-Done($msg) {
    Write-Host "[OK]    $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "[WARN]  $msg" -ForegroundColor Yellow
}

function Write-Skip($msg) {
    Write-Host "[SKIP]  $msg (receipt and installed files verified)" -ForegroundColor DarkGreen
}

function Test-NativeCommand($FilePath, $Arguments, $ExpectedPattern = "") {
    if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
        return $false
    }

    try {
        $commandOutput = (& $FilePath @Arguments 2>&1 | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) {
            return $false
        }
        if (-not [string]::IsNullOrWhiteSpace($ExpectedPattern) -and $commandOutput -notmatch $ExpectedPattern) {
            return $false
        }
        return $true
    }
    catch {
        return $false
    }
}

function Test-VerifiedSetupStep($StepId, $Fingerprint, [scriptblock]$Verification) {
    $receiptPath = Get-SetupReceiptPath -StateDirectory $StateDir -StepId $StepId
    $hadMatchingReceipt = Test-SetupReceipt -StateDirectory $StateDir -StepId $StepId -Fingerprint $Fingerprint
    $stepReady = Test-SetupStepReady -StateDirectory $StateDir -StepId $StepId -Fingerprint $Fingerprint -Verification $Verification
    if ($stepReady) {
        return $true
    }
    if ($hadMatchingReceipt -and -not (Test-Path -LiteralPath $receiptPath)) {
        Write-Warn "The '$StepId' receipt matched, but installed verification failed; rebuilding this step."
    }
    return $false
}

function Complete-SetupStep($StepId, $Fingerprint, [scriptblock]$Verification, [hashtable]$Details = @{}) {
    if (-not (Test-SetupVerification -Verification $Verification)) {
        throw "Installed verification failed for setup step '$StepId'"
    }
    Write-SetupReceipt -StateDirectory $StateDir -StepId $StepId -Fingerprint $Fingerprint -Details $Details | Out-Null
}

function Test-HermesRepository($GitPath, $RepositoryPath, $ExpectedCommit) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepositoryPath ".git") -PathType Container)) {
        return $false
    }
    try {
        $actualCommit = (& $GitPath -C $RepositoryPath rev-parse HEAD 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or $actualCommit -notmatch '^[0-9a-fA-F]{40}$') {
            return $false
        }
        if ([string]::IsNullOrWhiteSpace([string]$ExpectedCommit)) {
            return $true
        }
        return ($actualCommit -eq $ExpectedCommit)
    }
    catch {
        return $false
    }
}

function Invoke-LoggedPlaywrightInstall($PythonPath, $LogPath) {
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $PythonPath
    $startInfo.Arguments = "-m playwright install chromium"
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw "Unable to start the Playwright browser installer"
    }

    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $stdout = $stdoutTask.Result
    $stderr = $stderrTask.Result
    $combinedOutput = @(
        "Playwright Chromium installer"
        "Completed at UTC: $([DateTime]::UtcNow.ToString('o'))"
        "Exit code: $($process.ExitCode)"
        ""
        $stdout
        $stderr
    ) -join [Environment]::NewLine
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($LogPath, $combinedOutput, $utf8WithoutBom)

    if (-not [string]::IsNullOrWhiteSpace($stdout)) {
        Write-Host $stdout.TrimEnd()
    }
    if (-not [string]::IsNullOrWhiteSpace($stderr)) {
        Write-Host $stderr.TrimEnd() -ForegroundColor Yellow
    }
    return $process.ExitCode
}

function Assert-ArchiveIntegrity($Path, $ExpectedSha256, $ExpectedSize) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Archive not found: $Path"
    }
    $actualSize = (Get-Item -LiteralPath $Path).Length
    if ($actualSize -ne [int64]$ExpectedSize) {
        throw "Archive size mismatch for $(Split-Path $Path -Leaf): expected $ExpectedSize, got $actualSize"
    }
    $actualSha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualSha256 -ne ([string]$ExpectedSha256).ToLowerInvariant()) {
        throw "SHA-256 mismatch for $(Split-Path $Path -Leaf): expected $ExpectedSha256, got $actualSha256"
    }
}

function Download-File($Url, $OutFile, $ExpectedSha256, $ExpectedSize) {
    $name = Split-Path $Url -Leaf
    if (Test-Path $OutFile) {
        try {
            Assert-ArchiveIntegrity $OutFile $ExpectedSha256 $ExpectedSize
            $sizeMB = [math]::Round(([int64]$ExpectedSize) / 1048576, 2)
            $msg = "        " + $name + " already cached and verified (" + $sizeMB + " MB)."
            Write-Host $msg
            return
        }
        catch {
            Write-Warn ($name + " failed integrity verification - re-downloading ...")
            Remove-Item -LiteralPath $OutFile -Force
        }
    }
    $msg1 = "        Downloading " + $name + " ..."
    $msg2 = "        URL: " + $Url
    Write-Host $msg1 -ForegroundColor Cyan
    Write-Host $msg2 -ForegroundColor DarkGray

    # Prefer curl.exe for native progress bar (speed, percent, time left, time spent)
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        $curlArgs = @("-L", "-f", "--ssl-no-revoke", "--retry", "3", "--retry-delay", "2", "--connect-timeout", "30", "--max-time", "900", "-o", $OutFile, $Url)
        & curl.exe @curlArgs
        if ($LASTEXITCODE -ne 0) {
            Write-Warn ("curl.exe failed with exit code " + $LASTEXITCODE + " - falling back to PowerShell download ...")
            if (Test-Path $OutFile) { Remove-Item $OutFile -Force }
            try {
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
            } catch {
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            }
            try {
                Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -TimeoutSec 900
            }
            catch {
                if (Test-Path $OutFile) { Remove-Item $OutFile -Force }
                throw "Failed to download " + $name + ": " + $_
            }
        }
    } else {
        $ProgressPreference = 'Continue'
        try {
            Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -TimeoutSec 900
        }
        catch {
            if (Test-Path $OutFile) { Remove-Item $OutFile -Force }
            throw "Failed to download " + $name + ": " + $_
        }
        finally {
            $ProgressPreference = 'Continue'
        }
    }

    # Validate the exact locked artifact before extraction.
    try {
        Assert-ArchiveIntegrity $OutFile $ExpectedSha256 $ExpectedSize
    }
    catch {
        if (Test-Path -LiteralPath $OutFile) {
            Remove-Item -LiteralPath $OutFile -Force
        }
        throw
    }
    $downloadedSize = (Get-Item -LiteralPath $OutFile).Length
    $sizeMB = [math]::Round($downloadedSize / 1048576, 2)
    $msgDone = "        Download verified: " + $sizeMB + " MB."
    Write-Host $msgDone -ForegroundColor Green
}

function Extract-TarGz($Archive, $Destination) {
    $label = Split-Path $Archive -Leaf
    Write-Host "        Extracting $label ..." -NoNewline
    if (Test-Path $Destination) {
        Remove-Item $Destination -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    # Use Windows built-in tar to avoid Git Bash tar path issues
    $winTar = "C:\Windows\System32\tar.exe"
    if (Test-Path $winTar) {
        & $winTar -xzf "$Archive" -C "$Destination" --strip-components=1
    } else {
        & tar.exe -xzf "$Archive" -C "$Destination" --strip-components=1
    }
    if ($LASTEXITCODE -ne 0) {
        Remove-Item $Destination -Recurse -Force -ErrorAction SilentlyContinue
        throw "tar extraction failed for " + $label
    }
    Write-Host " done" -ForegroundColor Green
}

function Extract-Zip($Archive, $Destination) {
    $label = Split-Path $Archive -Leaf
    Write-Host "        Extracting $label ..." -NoNewline
    if (Test-Path $Destination) {
        Remove-Item $Destination -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    try {
        $extracted = $false
        try {
            Expand-Archive -Path $Archive -DestinationPath $Destination -Force
            $extracted = $true
        } catch {
            if (Test-Path $Destination) {
                Remove-Item $Destination -Recurse -Force
                New-Item -ItemType Directory -Force -Path $Destination | Out-Null
            }
        }

        $winTar = "C:\Windows\System32\tar.exe"
        if ((-not $extracted) -and (Test-Path $winTar)) {
            & $winTar -xf "$Archive" -C "$Destination" 2>$null
            if ($LASTEXITCODE -eq 0) {
                $extracted = $true
            }
        } elseif ((-not $extracted) -and (Get-Command tar.exe -ErrorAction SilentlyContinue)) {
            & tar.exe -xf "$Archive" -C "$Destination" 2>$null
            if ($LASTEXITCODE -eq 0) {
                $extracted = $true
            }
        }

        if (-not $extracted) {
            if (Test-Path $Destination) {
                Remove-Item $Destination -Recurse -Force
                New-Item -ItemType Directory -Force -Path $Destination | Out-Null
            }
            throw "no available zip extractor succeeded"
        }

        if (-not (Get-ChildItem $Destination -Force | Select-Object -First 1)) {
            throw "archive extracted with no files"
        }
    } catch {
        Remove-Item $Destination -Recurse -Force -ErrorAction SilentlyContinue
        throw "zip extraction failed for " + $label + ": " + $_
    }
    Write-Host " done" -ForegroundColor Green
}

function Extract-SevenZipSelfExtractor($Archive, $Destination) {
    $label = Split-Path $Archive -Leaf
    Write-Host "        Extracting $label ..." -NoNewline
    if (Test-Path -LiteralPath $Destination) {
        Remove-Item -LiteralPath $Destination -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    try {
        # PortableGit is a GUI-subsystem 7-Zip self-extractor. Windows PowerShell
        # can return from a direct invocation before that process exits, leaving
        # $LASTEXITCODE unchanged from an earlier native command. Wait for the
        # exact process and inspect its own exit code instead.
        $extractArguments = '-y -o"{0}"' -f $Destination
        $extractProcess = Start-Process `
            -FilePath $Archive `
            -ArgumentList $extractArguments `
            -Wait `
            -PassThru `
            -ErrorAction Stop
        if ($extractProcess.ExitCode -ne 0) {
            throw "self-extractor exited with code $($extractProcess.ExitCode)"
        }
        if (-not (Get-ChildItem -LiteralPath $Destination -Force | Select-Object -First 1)) {
            throw "archive extracted with no files"
        }
    }
    catch {
        Remove-Item -LiteralPath $Destination -Recurse -Force -ErrorAction SilentlyContinue
        throw "7-Zip self-extraction failed for ${label}: $_"
    }
    Write-Host " done" -ForegroundColor Green
}

$script:GitBashProbeOutput = $null
function Test-GitBashCompatibility($BashPath) {
    if (-not (Test-Path -LiteralPath $BashPath -PathType Leaf)) {
        $script:GitBashProbeOutput = "Git Bash executable not found: $BashPath"
        return $false
    }

    $process = $null
    try {
        $startInfo = New-Object System.Diagnostics.ProcessStartInfo
        $startInfo.FileName = $BashPath
        $startInfo.Arguments = '--noprofile --norc -c "/usr/bin/true; /usr/bin/cat --version >/dev/null"'
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true

        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $startInfo
        if (-not $process.Start()) {
            throw "unable to start Git Bash"
        }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(15000)) {
            try { $process.Kill() } catch {}
            $process.WaitForExit()
            throw "Git Bash compatibility probe timed out after 15 seconds"
        }
        $stdout = $stdoutTask.Result
        $stderr = $stderrTask.Result
        $script:GitBashProbeOutput = (@($stdout, $stderr) -join " ").Trim()
        return ($process.ExitCode -eq 0)
    }
    catch {
        $script:GitBashProbeOutput = $_.Exception.Message
        return $false
    }
    finally {
        if ($null -ne $process) {
            $process.Dispose()
        }
    }
}

function Move-SubfolderContents($Source, $Dest) {
    $sub = Get-ChildItem $Source -Directory | Select-Object -First 1
    if ($sub) {
        Install-StagedDirectory $sub.FullName $Dest
        Remove-Item $Source -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ---------------------------------------------------------------------------
# Health check: a matching ready flag is accepted only after live verification.
# ---------------------------------------------------------------------------
$readyFlag = Join-Path $RuntimeDir "ready.flag"
if (Test-Path $readyFlag) {
    $readyHash = (Get-Content -LiteralPath $readyFlag -Raw -ErrorAction SilentlyContinue).Trim()
    $readyManifestPath = Join-Path $RuntimeDir "runtime-manifest.json"
    $readyManifestValid = $false
    if (Test-Path -LiteralPath $readyManifestPath -PathType Leaf) {
        try {
            $readyManifest = Get-Content -LiteralPath $readyManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $readyManifestValid = (
                $readyManifest.schema_version -eq 1 -and
                $readyManifest.platform -eq "windows-x64" -and
                [string]$readyManifest.component_lock_sha256 -eq $ComponentLockHash
            )
        }
        catch {}
    }
    $readyPython = Join-Path $RuntimeDir "python\python.exe"
    $readyVenvPython = Join-Path $RuntimeDir "venv\Scripts\python.exe"
    $readyGit = Join-Path $RuntimeDir "git\cmd\git.exe"
    $readyGitBash = Join-Path $RuntimeDir "git\bin\bash.exe"
    $readySource = Join-Path $SrcDir "hermes-agent"
    $readyChecksPassed = (
        $readyHash -eq $ComponentLockHash -and
        $readyManifestValid -and
        (Test-NativeCommand $readyPython @("--version")) -and
        (Test-NativeCommand (Join-Path $RuntimeDir "node\node.exe") @("--version")) -and
        (Test-NativeCommand (Join-Path $RuntimeDir "uv\uv.exe") @("--version")) -and
        (Test-NativeCommand (Join-Path $RuntimeDir "bin\rg.exe") @("--version")) -and
        (Test-NativeCommand $readyGit @("--version")) -and
        (Test-GitBashCompatibility $readyGitBash) -and
        (Test-NativeCommand $readyVenvPython @("-c", "import hermes_cli.main")) -and
        (Test-HermesRepository $readyGit $readySource "")
    )
    if ($readyChecksPassed) {
        $readyHermesCommit = (& $readyGit -C $readySource rev-parse HEAD 2>$null | Out-String).Trim()
        $readySourceState = [ordered]@{
            schema_version = 1
            version = [string]$readyManifest.hermes_version
            version_role = "installed"
            ref = $HermesComponent.source.ref
            commit = $readyHermesCommit
            update_policy = $HermesComponent.update_policy
            component_lock_sha256 = $ComponentLockHash
        }
        $readySourceStatePresent = Move-LegacyHermesSourceState `
            -SourceDirectory $readySource `
            -RuntimeDirectory $RuntimeDir `
            -ExpectedComponentLockHash $ComponentLockHash `
            -FallbackSourceState $readySourceState
        if ($readySourceStatePresent) {
            $readySourceStatePath = Get-HermesSourceStatePath -RuntimeDirectory $RuntimeDir
            $readySourceStatePresent = Test-HermesSourceStateFile `
                -Path $readySourceStatePath `
                -ExpectedComponentLockHash $ComponentLockHash `
                -ExpectedCommit $readyHermesCommit
        }
        if (-not $readySourceStatePresent) {
            Write-HermesSourceState -RuntimeDirectory $RuntimeDir -SourceState $readySourceState | Out-Null
        }
        Set-HermesCaseCollisionWorkaround -GitExecutable $readyGit -SourceDirectory $readySource | Out-Null
        $adoptedDetails = @{ adopted_from_verified_runtime_manifest = $true }
        Write-SetupReceipt -StateDirectory $StateDir -StepId "python" -Fingerprint $PythonComponent.integrity.sha256 -Details $adoptedDetails | Out-Null
        Write-SetupReceipt -StateDirectory $StateDir -StepId "node" -Fingerprint $NodeComponent.integrity.sha256 -Details $adoptedDetails | Out-Null
        Write-SetupReceipt -StateDirectory $StateDir -StepId "uv" -Fingerprint $UvComponent.integrity.sha256 -Details $adoptedDetails | Out-Null
        Write-SetupReceipt -StateDirectory $StateDir -StepId "ripgrep" -Fingerprint $RgComponent.integrity.sha256 -Details $adoptedDetails | Out-Null
        Write-SetupReceipt -StateDirectory $StateDir -StepId "portablegit" -Fingerprint $GitComponent.integrity.sha256 -Details $adoptedDetails | Out-Null
        Write-SetupReceipt -StateDirectory $StateDir -StepId "hermes-source" -Fingerprint $readyHermesCommit -Details $adoptedDetails | Out-Null
        $readyVenvFingerprint = "$($PythonComponent.integrity.sha256):$($UvComponent.integrity.sha256)"
        $readyDependenciesFingerprint = "$ComponentLockHash`:$readyHermesCommit"
        Write-SetupReceipt -StateDirectory $StateDir -StepId "python-venv" -Fingerprint $readyVenvFingerprint -Details $adoptedDetails | Out-Null
        Write-SetupReceipt -StateDirectory $StateDir -StepId "hermes-dependencies" -Fingerprint $readyDependenciesFingerprint -Details $adoptedDetails | Out-Null

        $readyAnthropicVersion = $AnthropicRequirement.Substring($AnthropicRequirement.IndexOf("==") + 2)
        $readyAnthropicCheck = "import importlib.metadata as m; assert m.version('anthropic') == '$readyAnthropicVersion'"
        if (Test-NativeCommand $readyVenvPython @("-c", $readyAnthropicCheck)) {
            Write-SetupReceipt -StateDirectory $StateDir -StepId "provider-anthropic" -Fingerprint $AnthropicRequirement -Details $adoptedDetails | Out-Null
        }
        $readyTelegramVersion = $TelegramRequirement.Substring($TelegramRequirement.IndexOf("==") + 2)
        $readyTelegramCheck = "import importlib.metadata as m; assert m.version('python-telegram-bot') == '$readyTelegramVersion'"
        if (Test-NativeCommand $readyVenvPython @("-c", $readyTelegramCheck)) {
            Write-SetupReceipt -StateDirectory $StateDir -StepId "messaging-telegram" -Fingerprint $TelegramRequirement -Details $adoptedDetails | Out-Null
        }
        $readyPlaywrightPath = Join-Path $RuntimeDir "playwright"
        if (
            (Test-NativeCommand $readyVenvPython @("-c", "import playwright")) -and
            (Test-Path -LiteralPath $readyPlaywrightPath -PathType Container) -and
            (@(Get-ChildItem -LiteralPath $readyPlaywrightPath -Recurse -Filter "chrome.exe" -File -ErrorAction SilentlyContinue).Count -gt 0)
        ) {
            Write-SetupReceipt -StateDirectory $StateDir -StepId "playwright-chromium" -Fingerprint "$readyDependenciesFingerprint`:chromium" -Details $adoptedDetails | Out-Null
        }
        Write-Done "Runtime is already complete; no setup work is required"
        $SetupSucceeded = $true
        return
    }
    Write-Warn "ready.flag exists but its lock or installed verification failed; repairing only invalid steps."
    Remove-Item -LiteralPath $readyFlag -Force
}

# ---------------------------------------------------------------------------
# 1. Portable Python
# ---------------------------------------------------------------------------
Write-Step "Installing portable Python 3.11 ..."
$installedPythonExe = Join-Path $RuntimeDir "python\python.exe"
$pythonVersionPattern = [regex]::Escape(([string]$PythonComponent.version).Split("+")[0])
$pythonVerification = { Test-NativeCommand $installedPythonExe @("--version") $pythonVersionPattern }
if (Test-VerifiedSetupStep "python" $PythonComponent.integrity.sha256 $pythonVerification) {
    Write-Skip "Python $($PythonComponent.version)"
}
else {
    $pyArchive = Join-Path $RuntimeDir "python.tar.gz"
    Download-File $PythonComponent.source.url $pyArchive $PythonComponent.integrity.sha256 $PythonComponent.source.size_bytes
    $pythonTemp = Join-Path $TempDir "python"
    Extract-TarGz $pyArchive $pythonTemp
    $stagedPythonExe = Join-Path $pythonTemp "python.exe"
    if (-not (Test-NativeCommand $stagedPythonExe @("--version") $pythonVersionPattern)) {
        throw "Portable Python verification failed after extraction: $stagedPythonExe"
    }
    Install-StagedDirectory $pythonTemp (Join-Path $RuntimeDir "python")
    Complete-SetupStep "python" $PythonComponent.integrity.sha256 $pythonVerification @{ version = $PythonComponent.version }
    Write-Done "Python ready"
}

# ---------------------------------------------------------------------------
# 2. Node.js
# ---------------------------------------------------------------------------
Write-Step "Installing Node.js 22 LTS ..."
$installedNodeExe = Join-Path $RuntimeDir "node\node.exe"
$installedNpmCmd = Join-Path $RuntimeDir "node\npm.cmd"
$nodeVersionPattern = "v" + [regex]::Escape([string]$NodeComponent.version)
$nodeVerification = {
    (Test-NativeCommand $installedNodeExe @("--version") $nodeVersionPattern) -and
    (Test-NativeCommand $installedNpmCmd @("--version"))
}
if (Test-VerifiedSetupStep "node" $NodeComponent.integrity.sha256 $nodeVerification) {
    Write-Skip "Node.js $($NodeComponent.version)"
}
else {
    $nodeArchive = Join-Path $RuntimeDir "node.zip"
    Download-File $NodeComponent.source.url $nodeArchive $NodeComponent.integrity.sha256 $NodeComponent.source.size_bytes
    $nodeTemp = Join-Path $TempDir "node"
    Extract-Zip $nodeArchive $nodeTemp
    Move-SubfolderContents $nodeTemp (Join-Path $RuntimeDir "node")
    Complete-SetupStep "node" $NodeComponent.integrity.sha256 $nodeVerification @{ version = $NodeComponent.version }
    Write-Done "Node.js ready"
}

# ---------------------------------------------------------------------------
# 3. uv (Python package manager)
# ---------------------------------------------------------------------------
Write-Step "Installing uv ..."
$installedUvExe = Join-Path $RuntimeDir "uv\uv.exe"
$uvVersionPattern = [regex]::Escape([string]$UvComponent.version)
$uvVerification = { Test-NativeCommand $installedUvExe @("--version") $uvVersionPattern }
if (Test-VerifiedSetupStep "uv" $UvComponent.integrity.sha256 $uvVerification) {
    Write-Skip "uv $($UvComponent.version)"
}
else {
    $uvArchive = Join-Path $RuntimeDir "uv.zip"
    Download-File $UvComponent.source.url $uvArchive $UvComponent.integrity.sha256 $UvComponent.source.size_bytes
    $uvTemp = Join-Path $TempDir "uv"
    Extract-Zip $uvArchive $uvTemp
    $stagedUvExe = Get-ChildItem -LiteralPath $uvTemp -Recurse -Filter "uv.exe" | Select-Object -First 1
    if (-not $stagedUvExe) {
        throw "uv executable not found after extraction"
    }
    if ($stagedUvExe.DirectoryName -ne $uvTemp) {
        $uvFlatTemp = Join-Path $TempDir "uv-flat"
        if (Test-Path -LiteralPath $uvFlatTemp) {
            Remove-Item -LiteralPath $uvFlatTemp -Recurse -Force
        }
        New-Item -ItemType Directory -Path $uvFlatTemp | Out-Null
        Copy-Item -LiteralPath $stagedUvExe.FullName -Destination (Join-Path $uvFlatTemp "uv.exe")
        $uvxExe = Get-ChildItem -LiteralPath $uvTemp -Recurse -Filter "uvx.exe" | Select-Object -First 1
        if ($uvxExe) {
            Copy-Item -LiteralPath $uvxExe.FullName -Destination (Join-Path $uvFlatTemp "uvx.exe")
        }
        Remove-Item -LiteralPath $uvTemp -Recurse -Force
        $uvTemp = $uvFlatTemp
        $stagedUvExe = Get-Item -LiteralPath (Join-Path $uvTemp "uv.exe")
    }
    if (-not (Test-NativeCommand $stagedUvExe.FullName @("--version") $uvVersionPattern)) {
        throw "uv verification failed after extraction"
    }
    Install-StagedDirectory $uvTemp (Join-Path $RuntimeDir "uv")
    Complete-SetupStep "uv" $UvComponent.integrity.sha256 $uvVerification @{ version = $UvComponent.version }
    Write-Done "uv ready"
}

# ---------------------------------------------------------------------------
# 4. ripgrep
# ---------------------------------------------------------------------------
Write-Step "Installing ripgrep ..."
$installedRgExe = Join-Path $BinDir "rg.exe"
$rgVersionPattern = [regex]::Escape([string]$RgComponent.version)
$rgVerification = { Test-NativeCommand $installedRgExe @("--version") $rgVersionPattern }
if (Test-VerifiedSetupStep "ripgrep" $RgComponent.integrity.sha256 $rgVerification) {
    Write-Skip "ripgrep $($RgComponent.version)"
}
else {
    $rgArchive = Join-Path $RuntimeDir "rg.zip"
    Download-File $RgComponent.source.url $rgArchive $RgComponent.integrity.sha256 $RgComponent.source.size_bytes
    $rgTemp = Join-Path $TempDir "rg"
    Extract-Zip $rgArchive $rgTemp
    $rgExe = Get-ChildItem $rgTemp -Recurse -Filter "rg.exe" | Select-Object -First 1
    if (-not $rgExe) {
        throw "ripgrep executable not found after extraction"
    }
    Copy-Item $rgExe.FullName $installedRgExe -Force
    Complete-SetupStep "ripgrep" $RgComponent.integrity.sha256 $rgVerification @{ version = $RgComponent.version }
    Write-Done "ripgrep ready"
}

# ---------------------------------------------------------------------------
# 5. Git for Windows (PortableGit, including Git Bash)
# ---------------------------------------------------------------------------
Write-Step "Installing portable Git ..."
$gitExe = Join-Path $RuntimeDir "git\cmd\git.exe"
$gitVersionPattern = [regex]::Escape([string]$GitComponent.version)
$gitBash = Join-Path $RuntimeDir "git\bin\bash.exe"
$gitVerification = {
    (Test-NativeCommand $gitExe @("--version") $gitVersionPattern) -and
    (Test-GitBashCompatibility $gitBash)
}
if (Test-VerifiedSetupStep "portablegit" $GitComponent.integrity.sha256 $gitVerification) {
    Write-Skip "Git $($GitComponent.version)"
}
else {
    if ([string]$GitComponent.source.archive_type -ne "7z-sfx") {
        throw "PortableGit must use the locked 7z-sfx archive type"
    }
    $gitArchive = Join-Path $RuntimeDir "portablegit.7z.exe"
    Download-File $GitComponent.source.url $gitArchive $GitComponent.integrity.sha256 $GitComponent.source.size_bytes
    $gitTemp = Join-Path $TempDir "git"
    Extract-SevenZipSelfExtractor $gitArchive $gitTemp
    $stagedGitExe = Join-Path $gitTemp "cmd\git.exe"
    $stagedGitBash = Join-Path $gitTemp "bin\bash.exe"
    if (-not (Test-NativeCommand $stagedGitExe @("--version") $gitVersionPattern)) {
        throw "Portable Git verification failed after extraction: $stagedGitExe"
    }
    if (-not (Test-GitBashCompatibility $stagedGitBash)) {
        throw "Portable Git Bash verification failed after extraction: $stagedGitBash; $script:GitBashProbeOutput"
    }
    Install-StagedDirectory $gitTemp (Join-Path $RuntimeDir "git")
    Complete-SetupStep "portablegit" $GitComponent.integrity.sha256 $gitVerification @{
        version = $GitComponent.version
        bash = "git/bin/bash.exe"
    }
    Write-Done "Git ready"
}
$env:HERMES_GIT_BASH_PATH = $gitBash

# ---------------------------------------------------------------------------
# 6. Hermes source code
# ---------------------------------------------------------------------------
Write-Step "Fetching pinned Hermes Agent source code ..."
$srcTemp = Join-Path $TempDir "hermes-agent-source"
$destSrc = Join-Path $SrcDir "hermes-agent"
$hermesFingerprint = [string]$HermesComponent.source.commit
$hermesVerification = { Test-HermesRepository $gitExe $destSrc $HermesComponent.source.commit }
if (Test-HermesRepository $gitExe $destSrc "") {
    Move-LegacyHermesSourceState `
        -SourceDirectory $destSrc `
        -RuntimeDirectory $RuntimeDir `
        -ExpectedComponentLockHash $ComponentLockHash | Out-Null
    Set-HermesCaseCollisionWorkaround -GitExecutable $gitExe -SourceDirectory $destSrc | Out-Null
}
if (Test-VerifiedSetupStep "hermes-source" $hermesFingerprint $hermesVerification) {
    $actualHermesCommit = [string]$HermesComponent.source.commit
    Write-Skip "Hermes $($HermesComponent.version) source"
}
else {
    $preserveInstalledHermes = $false
    $installedSourceStatePath = Get-HermesSourceStatePath -RuntimeDirectory $RuntimeDir
    if (Test-Path -LiteralPath $installedSourceStatePath -PathType Leaf) {
        try {
            $installedSourceState = Get-Content -LiteralPath $installedSourceStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
            $installedOrigin = (& $gitExe -C $destSrc remote get-url origin 2>$null | Out-String).Trim()
            $installedCommit = (& $gitExe -C $destSrc rev-parse HEAD 2>$null | Out-String).Trim()
            if (
                $LASTEXITCODE -eq 0 -and
                $installedOrigin -eq [string]$HermesComponent.source.url -and
                $installedCommit -match '^[0-9a-fA-F]{40}$' -and
                [string]$installedSourceState.commit -eq $installedCommit -and
                [string]$installedSourceState.component_lock_sha256 -eq $ComponentLockHash -and
                $installedSourceState.update_policy.allow_newer_than_bootstrap -eq $true
            ) {
                $preserveInstalledHermes = $true
                $actualHermesCommit = $installedCommit
                Write-SetupReceipt -StateDirectory $StateDir -StepId "hermes-source" -Fingerprint $actualHermesCommit -Details @{
                    version = $HermesComponent.version
                    commit = $actualHermesCommit
                    preserved_user_update = ($actualHermesCommit -ne [string]$HermesComponent.source.commit)
                } | Out-Null
                if ($actualHermesCommit -ne [string]$HermesComponent.source.commit) {
                    Write-Warn "Preserving user-updated Hermes source at commit $actualHermesCommit instead of restoring the older bootstrap commit."
                }
                Write-Skip "Existing Hermes source"
            }
        }
        catch {}
    }

    if (-not $preserveInstalledHermes) {
    $reuseStaging = $false
    if (Test-Path -LiteralPath $srcTemp -PathType Container) {
        if (Test-Path -LiteralPath (Join-Path $srcTemp ".git") -PathType Container) {
            try {
                $stagedOrigin = (& $gitExe -C $srcTemp remote get-url origin 2>$null | Out-String).Trim()
                if ($LASTEXITCODE -eq 0 -and $stagedOrigin -eq [string]$HermesComponent.source.url) {
                    $reuseStaging = $true
                    Write-Host "        Reusing the managed Hermes staging repository from the previous attempt."
                }
            }
            catch {}
        }
        if (-not $reuseStaging) {
            Write-Warn "The managed Hermes staging directory is incomplete or belongs to another source; rebuilding staging only."
            Remove-Item -LiteralPath $srcTemp -Recurse -Force
        }
    }

    if (-not $reuseStaging) {
        New-Item -ItemType Directory -Path $srcTemp -Force | Out-Null
        & $gitExe -C $srcTemp init --quiet
        if ($LASTEXITCODE -ne 0) { throw "Failed to initialize the Hermes source staging repository" }
        & $gitExe -C $srcTemp remote add origin $HermesComponent.source.url
        if ($LASTEXITCODE -ne 0) { throw "Failed to configure the Hermes source remote" }
    }
    else {
        & $gitExe -C $srcTemp remote set-url origin $HermesComponent.source.url
        if ($LASTEXITCODE -ne 0) { throw "Failed to refresh the Hermes source remote" }
    }

    $gitFetchSucceeded = $false
    $gitFetchAttempts = 4
    for ($gitFetchAttempt = 1; $gitFetchAttempt -le $gitFetchAttempts; $gitFetchAttempt++) {
        & $gitExe -C $srcTemp fetch --depth 1 origin ("refs/tags/" + $HermesComponent.source.ref)
        if ($LASTEXITCODE -eq 0) {
            $gitFetchSucceeded = $true
            break
        }
        if ($gitFetchAttempt -lt $gitFetchAttempts) {
            $gitFetchDelaySeconds = [Math]::Pow(2, $gitFetchAttempt)
            Write-Warn "Hermes source fetch attempt $gitFetchAttempt/$gitFetchAttempts failed; retrying in $gitFetchDelaySeconds seconds ..."
            Start-Sleep -Seconds $gitFetchDelaySeconds
        }
    }
    if (-not $gitFetchSucceeded) {
        throw "Failed to fetch Hermes ref $($HermesComponent.source.ref) after $gitFetchAttempts attempts; the managed staging repository was retained for retry"
    }
    & $gitExe -C $srcTemp checkout --quiet --detach FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw "Failed to check out Hermes ref $($HermesComponent.source.ref)" }
    $actualHermesCommit = (& $gitExe -C $srcTemp rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $actualHermesCommit -ne $HermesComponent.source.commit) {
        throw "Hermes commit mismatch: expected $($HermesComponent.source.commit), got $actualHermesCommit"
    }
    $sourceState = [ordered]@{
        schema_version = 1
        version = $HermesComponent.version
        version_role = $HermesComponent.version_role
        ref = $HermesComponent.source.ref
        commit = $actualHermesCommit
        update_policy = $HermesComponent.update_policy
        component_lock_sha256 = $ComponentLockHash
    }
    # Keep the shallow Git metadata and official origin so the inherited
    # `hermes update` command can fetch newer upstream versions. The commit above
    # is the reviewed bootstrap state, not a permanent update ceiling.
    Install-StagedDirectory $srcTemp $destSrc
    Write-HermesSourceState -RuntimeDirectory $RuntimeDir -SourceState $sourceState | Out-Null
    Set-HermesCaseCollisionWorkaround -GitExecutable $gitExe -SourceDirectory $destSrc | Out-Null
    Complete-SetupStep "hermes-source" $hermesFingerprint $hermesVerification @{
        version = $HermesComponent.version
        commit = $actualHermesCommit
    }
    Write-Done "Hermes $($HermesComponent.version) source ready at commit $actualHermesCommit"
    }
}

# ---------------------------------------------------------------------------
# 7. Create virtual environment
# ---------------------------------------------------------------------------
Write-Step "Creating Python virtual environment ..."
$pythonExe = Join-Path $RuntimeDir "python\python.exe"
$venvDir   = Join-Path $RuntimeDir "venv"
$uvExe     = Join-Path $RuntimeDir "uv\uv.exe"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$venvFingerprint = "$($PythonComponent.integrity.sha256):$($UvComponent.integrity.sha256)"
$venvVerification = { Test-NativeCommand $venvPython @("--version") $pythonVersionPattern }
if (Test-VerifiedSetupStep "python-venv" $venvFingerprint $venvVerification) {
    Write-Skip "Python virtual environment"
}
else {
    if (Test-Path -LiteralPath $venvDir) {
        Remove-Item -LiteralPath $venvDir -Recurse -Force
    }
    & $uvExe venv $venvDir --python $pythonExe
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "uv venv failed - falling back to Python venv with copied files ..."
        Remove-Item $venvDir -Recurse -Force -ErrorAction SilentlyContinue
        & $pythonExe -m venv $venvDir --copies
        if ($LASTEXITCODE -ne 0) { throw "Failed to create venv" }
    }
    Complete-SetupStep "python-venv" $venvFingerprint $venvVerification @{ python_version = $PythonComponent.version }
    Write-Done "Virtual environment ready"
}

# ---------------------------------------------------------------------------
# 8. Install Hermes dependencies
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Continue"
Write-Step "Installing Hermes Python dependencies ..."
Write-Host "        This may take 3-10 minutes depending on your connection."
$dependenciesFingerprint = "$ComponentLockHash`:$actualHermesCommit"
$dependenciesVerification = { Test-NativeCommand $venvPython @("-c", "import hermes_cli.main") }
if (Test-VerifiedSetupStep "hermes-dependencies" $dependenciesFingerprint $dependenciesVerification) {
    Write-Skip "Hermes Python dependencies"
}
else {
    # Copy mode avoids hard-link failures and performance cliffs on exFAT.
    & $uvExe pip install --python $venvPython --link-mode=copy -e "$destSrc[all]"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "        uv install failed - falling back to pip ..."
        & $venvPython -m ensurepip --upgrade | Out-Null
        & $venvPython -m pip install -e "$destSrc[all]"
        if ($LASTEXITCODE -ne 0) { throw "Failed to install Hermes dependencies" }
    }
    Complete-SetupStep "hermes-dependencies" $dependenciesFingerprint $dependenciesVerification @{
        hermes_commit = $actualHermesCommit
    }
    Write-Done "Dependencies installed"
}

# ---------------------------------------------------------------------------
# 9. Install provider dependencies
# ---------------------------------------------------------------------------
Write-Step "Installing provider dependencies ..."
$AnthropicInstalled = $false
$AnthropicVersion = $AnthropicRequirement.Substring($AnthropicRequirement.IndexOf("==") + 2)
$anthropicVerificationCode = "import importlib.metadata as m; assert m.version('anthropic') == '$AnthropicVersion'"
$anthropicVerification = { Test-NativeCommand $venvPython @("-c", $anthropicVerificationCode) }
if (Test-VerifiedSetupStep "provider-anthropic" $AnthropicRequirement $anthropicVerification) {
    $AnthropicInstalled = $true
    Write-Skip "Anthropic provider dependency"
}
else {
    & $uvExe pip install --python $venvPython --link-mode=copy $AnthropicRequirement
    if ($LASTEXITCODE -ne 0) {
        & $venvPython -m pip install $AnthropicRequirement >$null 2>$null
    }
    if (Test-SetupVerification -Verification $anthropicVerification) {
        $AnthropicInstalled = $true
        Complete-SetupStep "provider-anthropic" $AnthropicRequirement $anthropicVerification @{ version = $AnthropicVersion }
        Write-Done "Provider dependencies ready"
    }
    else {
        Remove-SetupReceipt -StateDirectory $StateDir -StepId "provider-anthropic"
        Write-Warn "Anthropic provider install failed - will retry on first use"
    }
}

# ---------------------------------------------------------------------------
# 10. Install messaging dependencies (Telegram, etc.)
# ---------------------------------------------------------------------------
# Hermes [all] intentionally excludes messaging deps for size.
# The lazy-install system is supposed to auto-install on first use,
# but it can fail silently in some environments. Pre-install here
# so Telegram works out of the box.
# ---------------------------------------------------------------------------
Write-Step "Installing messaging dependencies (Telegram) ..."
$TelegramInstalled = $false
$TelegramVersion = $TelegramRequirement.Substring($TelegramRequirement.IndexOf("==") + 2)
$telegramVerificationCode = "import importlib.metadata as m; assert m.version('python-telegram-bot') == '$TelegramVersion'"
$telegramVerification = { Test-NativeCommand $venvPython @("-c", $telegramVerificationCode) }
if (Test-VerifiedSetupStep "messaging-telegram" $TelegramRequirement $telegramVerification) {
    $TelegramInstalled = $true
    Write-Skip "python-telegram-bot dependency"
}
else {
    & $uvExe pip install --python $venvPython --link-mode=copy $TelegramRequirement
    if ($LASTEXITCODE -ne 0) {
        & $venvPython -m pip install $TelegramRequirement >$null 2>$null
    }
    if (Test-SetupVerification -Verification $telegramVerification) {
        $TelegramInstalled = $true
        Complete-SetupStep "messaging-telegram" $TelegramRequirement $telegramVerification @{ version = $TelegramVersion }
        Write-Done "python-telegram-bot ready"
    }
    else {
        Remove-SetupReceipt -StateDirectory $StateDir -StepId "messaging-telegram"
        Write-Warn "python-telegram-bot install failed - will retry on first use"
    }
}

# ---------------------------------------------------------------------------
# 11. Install Playwright browsers (optional, for web tools)
# ---------------------------------------------------------------------------
Write-Step "Installing Playwright browsers (optional) ..."
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $RuntimeDir "playwright"
$PlaywrightInstalled = $false
$playwrightFingerprint = "$dependenciesFingerprint`:chromium"
$playwrightVerification = {
    (Test-NativeCommand $venvPython @("-c", "import playwright")) -and
    (Test-Path -LiteralPath $env:PLAYWRIGHT_BROWSERS_PATH -PathType Container) -and
    (@(Get-ChildItem -LiteralPath $env:PLAYWRIGHT_BROWSERS_PATH -Recurse -Filter "chrome.exe" -File -ErrorAction SilentlyContinue).Count -gt 0)
}
if (Test-VerifiedSetupStep "playwright-chromium" $playwrightFingerprint $playwrightVerification) {
    $PlaywrightInstalled = $true
    Write-Skip "Playwright Chromium browser"
}
else {
    $playwrightLogStamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
    $playwrightLogSuffix = [Guid]::NewGuid().ToString("N").Substring(0, 8)
    $PlaywrightLogPath = Join-Path $SetupLogDir ("playwright-{0}-{1}.log" -f $playwrightLogStamp, $playwrightLogSuffix)
    try {
        $playwrightExitCode = Invoke-LoggedPlaywrightInstall $venvPython $PlaywrightLogPath
    }
    catch {
        $playwrightExitCode = 1
        [System.IO.File]::WriteAllText($PlaywrightLogPath, $_.Exception.Message, (New-Object System.Text.UTF8Encoding($false)))
    }
    if ($playwrightExitCode -eq 0 -and (Test-SetupVerification -Verification $playwrightVerification)) {
        $PlaywrightInstalled = $true
        Complete-SetupStep "playwright-chromium" $playwrightFingerprint $playwrightVerification @{ log = (Split-Path $PlaywrightLogPath -Leaf) }
        Write-Done "Playwright browsers ready"
    }
    else {
        Remove-SetupReceipt -StateDirectory $StateDir -StepId "playwright-chromium"
        Write-Warn "Playwright browser install failed (web tools may be limited). Diagnostic log: $PlaywrightLogPath"
    }
}

# ---------------------------------------------------------------------------
# 12. Record installed state and mark ready
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$hermesVersionCode = "import pathlib,tomllib; print(tomllib.loads((pathlib.Path.cwd()/'pyproject.toml').read_text(encoding='utf-8'))['project']['version'])"
Push-Location $destSrc
try {
    $hermesVersionOutput = @(& $pythonExe -c $hermesVersionCode 2>$null)
}
finally {
    Pop-Location
}
if ($LASTEXITCODE -ne 0 -or $hermesVersionOutput.Count -ne 1 -or [string]::IsNullOrWhiteSpace([string]$hermesVersionOutput[0])) {
    throw "Unable to record the installed Hermes version."
}
$actualHermesVersion = ([string]$hermesVersionOutput[0]).Trim()
$runtimeManifest = [ordered]@{
    schema_version = 1
    platform = "windows-x64"
    installed_at_utc = [DateTime]::UtcNow.ToString("o")
    component_lock_sha256 = $ComponentLockHash
    hermes_commit = $actualHermesCommit
    hermes_version = $actualHermesVersion
    hermes_update_channel = "origin/{0}" -f [string]$HermesComponent.update_policy.default_channel
    components = @($ComponentLock.components | ForEach-Object {
        [ordered]@{
            id = $_.id
            version = $_.version
        }
    })
    supplemental_python_packages = @(
        [ordered]@{
            requirement = $AnthropicRequirement
            installed = $AnthropicInstalled
        },
        [ordered]@{
            requirement = $TelegramRequirement
            installed = $TelegramInstalled
        }
    )
    optional_features = [ordered]@{
        playwright_chromium_installed = $PlaywrightInstalled
    }
}
$runtimeManifestPath = Join-Path $RuntimeDir "runtime-manifest.json"
$runtimeManifestTemp = Join-Path $RuntimeDir (".runtime-manifest.tmp-" + [Guid]::NewGuid().ToString("N"))
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
try {
    [System.IO.File]::WriteAllText($runtimeManifestTemp, (($runtimeManifest | ConvertTo-Json -Depth 8) + [Environment]::NewLine), $utf8WithoutBom)
    Move-Item -LiteralPath $runtimeManifestTemp -Destination $runtimeManifestPath -Force
}
finally {
    if (Test-Path -LiteralPath $runtimeManifestTemp) {
        Remove-Item -LiteralPath $runtimeManifestTemp -Force -ErrorAction SilentlyContinue
    }
}
[System.IO.File]::WriteAllText($readyFlag, ($ComponentLockHash + [Environment]::NewLine), $utf8WithoutBom)
$SetupSucceeded = $true

# Cleanup temp
Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Setup Complete! Launching Hermes..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Start-Sleep -Seconds 1
}
catch {
    $SetupFailure = $_
    [Console]::Error.WriteLine("[ERROR] Runtime setup did not complete: {0}", $_.Exception.Message)
}
finally {
    if ($SetupTranscriptStarted) {
        try {
            Stop-Transcript | Out-Null
        }
        catch {
            Write-Warning "Unable to close the setup transcript: $($_.Exception.Message)"
        }
    }
    Write-Host "[portable-log] Setup transcript: $SetupLogPath"
}

if (-not $SetupSucceeded) {
    exit 1
}
