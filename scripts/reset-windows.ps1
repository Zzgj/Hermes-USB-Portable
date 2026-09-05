# ============================================================================
# Hermes Portable - Reset Script (Windows)
# ============================================================================
# Deletes downloaded runtimes and source code to trigger fresh first-run setup.
#
# Usage:
#   .\scripts\reset-windows.ps1 -Mode soft    # Keep data/, knowledge/, and logs/
#   .\scripts\reset-windows.ps1 -Mode full    # Also delete data/; preserve knowledge/ and logs/
# ============================================================================

param(
    [ValidateSet("soft", "full")]
    [string]$Mode = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Root = [System.IO.Path]::GetFullPath($Root).TrimEnd("\", "/")

if (-not (Test-Path -LiteralPath (Join-Path $Root "launch.bat") -PathType Leaf)) {
    throw "Refusing to reset a directory that is not a Hermes Portable root: $Root"
}

function Test-CommandLineBelongsToPortableRoot {
    param(
        [string]$CommandLine,
        [string]$PortableRoot
    )

    if ([string]::IsNullOrWhiteSpace($CommandLine)) {
        return $false
    }

    $normalizedCommandLine = $CommandLine.Replace("/", "\")
    $normalizedRoot = [System.IO.Path]::GetFullPath($PortableRoot).TrimEnd("\", "/").Replace("/", "\")
    $rootPrefix = $normalizedRoot + "\"
    return $normalizedCommandLine.IndexOf($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Stop-PortableGateway {
    param(
        [string]$PortableRoot
    )

    $lockFile = Join-Path $PortableRoot "data\auth.lock"
    if (Test-Path -LiteralPath $lockFile) {
        Write-Host "[INFO]  Stopping gateway (removing portable lock) ..." -ForegroundColor Yellow
        Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
    }

    try {
        $managedGatewayProcesses = @(
            Get-CimInstance -ClassName Win32_Process -ErrorAction Stop |
                Where-Object {
                    $_.CommandLine -match '(?i)hermes.*gateway' -and
                    (Test-CommandLineBelongsToPortableRoot -CommandLine $_.CommandLine -PortableRoot $PortableRoot)
                }
        )
    }
    catch {
        Write-Host "[WARN]  Unable to inspect gateway process command lines; continuing without terminating processes." -ForegroundColor Yellow
        $managedGatewayProcesses = @()
    }

    foreach ($gatewayProcess in $managedGatewayProcesses) {
        Write-Host "[INFO]  Stopping gateway process PID $($gatewayProcess.ProcessId) for this portable root ..." -ForegroundColor Yellow
        Stop-Process -Id $gatewayProcess.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

# If no mode provided, ask interactively
if (-not $Mode) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   Hermes Portable - Reset" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Choose reset mode:" -ForegroundColor Yellow
    Write-Host "  [1] Soft reset  - Delete runtimes + source, keep data/ (API keys, config, history)"
    Write-Host "  [2] Full reset  - Also delete data/; preserve knowledge/ and logs/"
    Write-Host ""
    $choice = Read-Host "Enter 1 or 2"
    if ($choice -eq "2") {
        $Mode = "full"
    } else {
        $Mode = "soft"
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Hermes Portable - Reset ($Mode)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# --- Soft reset: delete runtimes + source, keep data ---
$foldersToDelete = @()

$runtimes = Join-Path $Root ".cache\runtimes"
if (Test-Path $runtimes) {
    $foldersToDelete += $runtimes
}

$src = Join-Path $Root "src\hermes-agent"
if (Test-Path $src) {
    $foldersToDelete += $src
}

# --- Full reset: also delete Hermes data; preserve knowledge and diagnostics. ---
if ($Mode -eq "full") {
    $data = Join-Path $Root "data"
    if (Test-Path $data) {
        $foldersToDelete += $data
    }
    $cache = Join-Path $Root ".cache"
    if (Test-Path $cache) {
        $foldersToDelete += $cache
    }
}

# Confirm before deleting
Write-Host ""
Write-Host "The following folders will be DELETED:" -ForegroundColor Yellow
foreach ($f in $foldersToDelete) {
    $size = 0
    if (Test-Path $f) {
        $size = [math]::Round((Get-ChildItem $f -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
    }
    Write-Host "  - $f ($size MB)" -ForegroundColor Red
}

if ($Mode -eq "soft") {
    Write-Host ""
    Write-Host "Your portable user content is PRESERVED:" -ForegroundColor Green
    Write-Host "  - $Root\data\.env        (API keys)"
    Write-Host "  - $Root\data\config.yaml  (settings)"
    Write-Host "  - $Root\data\sessions\    (chat history)"
    Write-Host "  - $Root\knowledge\         (knowledge base)"
    Write-Host "  - $Root\logs\              (Workbench diagnostics)"
}

Write-Host ""
$confirm = Read-Host "Type 'yes' to confirm deletion"
if ($confirm -ne "yes") {
    Write-Host "Cancelled. Nothing was deleted." -ForegroundColor Yellow
    exit 0
}

# Stop only the Gateway owned by this exact portable root, and only after the
# user has confirmed the destructive reset.
Stop-PortableGateway -PortableRoot $Root

# Perform deletion
foreach ($f in $foldersToDelete) {
    if (Test-Path $f) {
        Write-Host "[DEL]   $f ..." -NoNewline
        Remove-Item $f -Recurse -Force
        Write-Host " done" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Reset Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

if ($Mode -eq "soft") {
    Write-Host ""
    Write-Host "Next step: run .\launch.bat to re-download runtimes"
    Write-Host "Your API keys and config are still saved in data\"
} else {
    Write-Host ""
    Write-Host "Next step: run .\launch.bat to rebuild and reconfigure Hermes"
    Write-Host "You'll need to re-run the setup wizard and re-enter API keys"
    Write-Host "Your knowledge\ and logs\ folders were preserved"
}
