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

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
$CacheDir   = Join-Path $Root ".cache"
$RuntimeDir = Join-Path $CacheDir "runtimes\windows-x64"
$SrcDir     = Join-Path $Root "src"
$BinDir     = Join-Path $RuntimeDir "bin"
$TempDir    = Join-Path $Root ".tmp"

# ---------------------------------------------------------------------------
# Locked runtime components
# ---------------------------------------------------------------------------
$ComponentLockPath = Join-Path $Root "manifests\runtime-components.windows-x64.json"
if (-not (Test-Path -LiteralPath $ComponentLockPath -PathType Leaf)) {
    throw "Runtime component lock not found: $ComponentLockPath"
}
$ComponentLock = Get-Content -LiteralPath $ComponentLockPath -Raw | ConvertFrom-Json
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
$GitComponent = Get-LockedComponent "mingit"
$HermesComponent = Get-LockedComponent "hermes-agent"

foreach ($archiveComponent in @($PythonComponent, $NodeComponent, $UvComponent, $RgComponent, $GitComponent)) {
    Assert-LockedComponent $archiveComponent "archive"
}
Assert-LockedComponent $HermesComponent "git"

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

New-Item -ItemType Directory -Force -Path $RuntimeDir, $SrcDir, $BinDir, $TempDir | Out-Null

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

function Move-SubfolderContents($Source, $Dest) {
    $sub = Get-ChildItem $Source -Directory | Select-Object -First 1
    if ($sub) {
        Install-StagedDirectory $sub.FullName $Dest
        Remove-Item $Source -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Install-StagedDirectory($Source, $Dest) {
    if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
        throw "Staged source directory not found: $Source"
    }

    if ((Test-Path -LiteralPath $Dest) -and -not (Test-Path -LiteralPath $Dest -PathType Container)) {
        throw "Destination exists and is not a directory: $Dest"
    }

    $backup = $Dest + ".backup-" + [Guid]::NewGuid().ToString("N")
    $hadExisting = Test-Path -LiteralPath $Dest -PathType Container
    $installedNew = $false
    if ($hadExisting) {
        Move-Item -LiteralPath $Dest -Destination $backup
    }

    try {
        Move-Item -LiteralPath $Source -Destination $Dest
        $installedNew = $true
        if ($hadExisting -and (Test-Path -LiteralPath $backup)) {
            Remove-Item -LiteralPath $backup -Recurse -Force
        }
    }
    catch {
        if ($installedNew -and (Test-Path -LiteralPath $Dest)) {
            Remove-Item -LiteralPath $Dest -Recurse -Force -ErrorAction SilentlyContinue
        }
        if ($hadExisting -and (Test-Path -LiteralPath $backup)) {
            Move-Item -LiteralPath $backup -Destination $Dest
        }
        throw
    }
}

# ---------------------------------------------------------------------------
# Health check: if ready.flag exists but core files are missing, start fresh
# ---------------------------------------------------------------------------
$readyFlag = Join-Path $RuntimeDir "ready.flag"
if (Test-Path $readyFlag) {
    $coreFiles = @("python\python.exe", "uv\uv.exe", "venv\Scripts\python.exe")
    $missing = $coreFiles | Where-Object { -not (Test-Path (Join-Path $RuntimeDir $_)) }
    if ($missing) {
        Write-Warn "ready.flag exists but core files are missing - restarting setup ..."
    }
    Remove-Item -LiteralPath $readyFlag -Force
}

# ---------------------------------------------------------------------------
# 1. Portable Python
# ---------------------------------------------------------------------------
Write-Step "Installing portable Python 3.11 ..."
$pyArchive = Join-Path $RuntimeDir "python.tar.gz"
Download-File $PythonComponent.source.url $pyArchive $PythonComponent.integrity.sha256 $PythonComponent.source.size_bytes
$pythonTemp = Join-Path $TempDir "python"
Extract-TarGz $pyArchive $pythonTemp
$stagedPythonExe = Join-Path $pythonTemp "python.exe"
if (-not (Test-Path -LiteralPath $stagedPythonExe -PathType Leaf)) {
    throw "Portable Python executable not found after extraction: $stagedPythonExe"
}
& $stagedPythonExe --version | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Portable Python verification failed" }
Install-StagedDirectory $pythonTemp (Join-Path $RuntimeDir "python")
Write-Done "Python ready"

# ---------------------------------------------------------------------------
# 2. Node.js
# ---------------------------------------------------------------------------
Write-Step "Installing Node.js 22 LTS ..."
$nodeArchive = Join-Path $RuntimeDir "node.zip"
Download-File $NodeComponent.source.url $nodeArchive $NodeComponent.integrity.sha256 $NodeComponent.source.size_bytes
$nodeTemp = Join-Path $TempDir "node"
Extract-Zip $nodeArchive $nodeTemp
Move-SubfolderContents $nodeTemp (Join-Path $RuntimeDir "node")
& (Join-Path $RuntimeDir "node\node.exe") --version | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Node.js verification failed" }
& (Join-Path $RuntimeDir "node\npm.cmd") --version | Out-Null
if ($LASTEXITCODE -ne 0) { throw "npm verification failed" }
Write-Done "Node.js ready"

# ---------------------------------------------------------------------------
# 3. uv (Python package manager)
# ---------------------------------------------------------------------------
Write-Step "Installing uv ..."
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
& $stagedUvExe.FullName --version | Out-Null
if ($LASTEXITCODE -ne 0) { throw "uv verification failed" }
Install-StagedDirectory $uvTemp (Join-Path $RuntimeDir "uv")
Write-Done "uv ready"

# ---------------------------------------------------------------------------
# 4. ripgrep
# ---------------------------------------------------------------------------
Write-Step "Installing ripgrep ..."
$rgArchive = Join-Path $RuntimeDir "rg.zip"
Download-File $RgComponent.source.url $rgArchive $RgComponent.integrity.sha256 $RgComponent.source.size_bytes
$rgTemp = Join-Path $TempDir "rg"
Extract-Zip $rgArchive $rgTemp
$rgExe = Get-ChildItem $rgTemp -Recurse -Filter "rg.exe" | Select-Object -First 1
if ($rgExe) {
    Copy-Item $rgExe.FullName (Join-Path $BinDir "rg.exe") -Force
    & (Join-Path $BinDir "rg.exe") --version | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "ripgrep verification failed" }
    Write-Done "ripgrep ready"
} else {
    throw "ripgrep executable not found after extraction"
}

# ---------------------------------------------------------------------------
# 5. Git (MinGit)
# ---------------------------------------------------------------------------
Write-Step "Installing portable Git ..."
$gitArchive = Join-Path $RuntimeDir "git.zip"
Download-File $GitComponent.source.url $gitArchive $GitComponent.integrity.sha256 $GitComponent.source.size_bytes
$gitTemp = Join-Path $TempDir "git"
Extract-Zip $gitArchive $gitTemp
$stagedGitExe = Join-Path $gitTemp "cmd\git.exe"
if (-not (Test-Path -LiteralPath $stagedGitExe -PathType Leaf)) {
    throw "Portable Git executable not found after extraction: $stagedGitExe"
}
& $stagedGitExe --version | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Portable Git verification failed" }
Install-StagedDirectory $gitTemp (Join-Path $RuntimeDir "git")
$gitExe = Join-Path $RuntimeDir "git\cmd\git.exe"
Write-Done "Git ready"

# ---------------------------------------------------------------------------
# 6. Hermes source code
# ---------------------------------------------------------------------------
Write-Step "Fetching pinned Hermes Agent source code ..."
$srcTemp = Join-Path $TempDir "hermes-agent-source"
if (Test-Path -LiteralPath $srcTemp) {
    Remove-Item -LiteralPath $srcTemp -Recurse -Force
}
New-Item -ItemType Directory -Path $srcTemp | Out-Null
& $gitExe -C $srcTemp init --quiet
if ($LASTEXITCODE -ne 0) { throw "Failed to initialize the Hermes source staging repository" }
& $gitExe -C $srcTemp remote add origin $HermesComponent.source.url
if ($LASTEXITCODE -ne 0) { throw "Failed to configure the Hermes source remote" }
& $gitExe -C $srcTemp fetch --depth 1 origin ("refs/tags/" + $HermesComponent.source.ref)
if ($LASTEXITCODE -ne 0) { throw "Failed to fetch Hermes ref $($HermesComponent.source.ref)" }
& $gitExe -C $srcTemp checkout --quiet --detach FETCH_HEAD
if ($LASTEXITCODE -ne 0) { throw "Failed to check out Hermes ref $($HermesComponent.source.ref)" }
$actualHermesCommit = (& $gitExe -C $srcTemp rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $actualHermesCommit -ne $HermesComponent.source.commit) {
    throw "Hermes commit mismatch: expected $($HermesComponent.source.commit), got $actualHermesCommit"
}
$sourceState = [ordered]@{
    schema_version = 1
    version = $HermesComponent.version
    ref = $HermesComponent.source.ref
    commit = $actualHermesCommit
    component_lock_sha256 = $ComponentLockHash
}
$sourceStatePath = Join-Path $srcTemp ".portable-source.json"
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($sourceStatePath, (($sourceState | ConvertTo-Json -Depth 4) + [Environment]::NewLine), $utf8WithoutBom)
Remove-Item -LiteralPath (Join-Path $srcTemp ".git") -Recurse -Force
$destSrc = Join-Path $SrcDir "hermes-agent"
Install-StagedDirectory $srcTemp $destSrc
Write-Done "Hermes $($HermesComponent.version) source ready at commit $actualHermesCommit"

# ---------------------------------------------------------------------------
# 7. Create virtual environment
# ---------------------------------------------------------------------------
Write-Step "Creating Python virtual environment ..."
$pythonExe = Join-Path $RuntimeDir "python\python.exe"
$venvDir   = Join-Path $RuntimeDir "venv"
$uvExe     = Join-Path $RuntimeDir "uv\uv.exe"

& $uvExe venv $venvDir --python $pythonExe
if ($LASTEXITCODE -ne 0) {
    Write-Warn "uv venv failed - falling back to Python venv with copied files ..."
    Remove-Item $venvDir -Recurse -Force -ErrorAction SilentlyContinue
    & $pythonExe -m venv $venvDir --copies
    if ($LASTEXITCODE -ne 0) { throw "Failed to create venv" }
}
& (Join-Path $venvDir "Scripts\python.exe") --version | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Virtual environment verification failed" }
Write-Done "Virtual environment ready"

# ---------------------------------------------------------------------------
# 8. Install Hermes dependencies
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Continue"
Write-Step "Installing Hermes Python dependencies ..."
Write-Host "        This may take 3-10 minutes depending on your connection."
$venvPython = Join-Path $venvDir "Scripts\python.exe"

# Try uv first (faster), fall back to pip on unsupported filesystem (e.g. ExFAT)
& $uvExe pip install --python $venvPython --link-mode=copy -e "$destSrc[all]"
if ($LASTEXITCODE -ne 0) {
    Write-Host "        uv install failed - falling back to pip ..."
    & $venvPython -m ensurepip --upgrade | Out-Null
    & $venvPython -m pip install -e "$destSrc[all]"
    if ($LASTEXITCODE -ne 0) { throw "Failed to install Hermes dependencies" }
}
Write-Done "Dependencies installed"

# ---------------------------------------------------------------------------
# 9. Install provider dependencies
# ---------------------------------------------------------------------------
Write-Step "Installing provider dependencies ..."
$AnthropicInstalled = $false
& $uvExe pip install --python $venvPython --link-mode=copy $AnthropicRequirement
if ($LASTEXITCODE -ne 0) {
    & $venvPython -m pip install $AnthropicRequirement >$null 2>$null
    if ($LASTEXITCODE -eq 0) {
        $AnthropicInstalled = $true
        Write-Done "Provider dependencies ready"
    } else {
        Write-Warn "Anthropic provider install failed - will retry on first use"
    }
} else {
    $AnthropicInstalled = $true
    Write-Done "Provider dependencies ready"
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
& $uvExe pip install --python $venvPython --link-mode=copy $TelegramRequirement
if ($LASTEXITCODE -ne 0) {
    & $venvPython -m pip install $TelegramRequirement >$null 2>$null
    if ($LASTEXITCODE -eq 0) {
        $TelegramInstalled = $true
        Write-Done "python-telegram-bot ready"
    } else {
        Write-Warn "python-telegram-bot install failed - will retry on first use"
    }
} else {
    $TelegramInstalled = $true
    Write-Done "python-telegram-bot ready"
}

# ---------------------------------------------------------------------------
# 11. Install Playwright browsers (optional, for web tools)
# ---------------------------------------------------------------------------
Write-Step "Installing Playwright browsers (optional) ..."
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $RuntimeDir "playwright"
$PlaywrightInstalled = $false
& $venvPython -m playwright install chromium 2>$null
if ($LASTEXITCODE -eq 0) {
    $PlaywrightInstalled = $true
    Write-Done "Playwright browsers ready"
} else {
    Write-Warn "Playwright browser install failed (web tools may be limited)"
}

# ---------------------------------------------------------------------------
# 12. Record installed state and mark ready
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$runtimeManifest = [ordered]@{
    schema_version = 1
    platform = "windows-x64"
    installed_at_utc = [DateTime]::UtcNow.ToString("o")
    component_lock_sha256 = $ComponentLockHash
    hermes_commit = $actualHermesCommit
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

# Cleanup temp
Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Setup Complete! Launching Hermes..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Start-Sleep -Seconds 1
