[CmdletBinding()]
param(
    [string]$InitializerPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts/initialize-portable.ps1")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

function Invoke-Initializer {
    param([string]$Target)

    $processOutput = & (Get-Process -Id $PID).Path -NoLogo -NoProfile -File $InitializerPath -TargetDirectory $Target 2>&1
    $exitCode = $LASTEXITCODE
    foreach ($line in $processOutput) {
        Write-Host $line
    }
    return $exitCode
}

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("hermes-portable-initializer-tests-{0}" -f [Guid]::NewGuid().ToString("N"))

try {
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    $freshTarget = Join-Path $testRoot "fresh-target"
    $freshExitCode = Invoke-Initializer -Target $freshTarget
    Assert-True ($freshExitCode -eq 0) "a missing target directory should be created"
    Assert-True (Test-Path -LiteralPath $freshTarget -PathType Container) "fresh target should exist"

    $target = Join-Path $testRoot "Portable AI 测试"
    $profiles = Join-Path $target "data/profiles"
    New-Item -ItemType Directory -Path $profiles -Force | Out-Null
    $sentinel = Join-Path $profiles "keep-me.txt"
    [System.IO.File]::WriteAllText($sentinel, "user-data-must-survive")

    $firstExitCode = Invoke-Initializer -Target $target
    Assert-True ($firstExitCode -eq 0) "first initialization should succeed"
    Assert-True (Test-Path -LiteralPath (Join-Path $target "runtime/hermes") -PathType Container) "runtime/hermes should exist"
    Assert-True (Test-Path -LiteralPath (Join-Path $target "knowledge/ObsidianVault/90-Templates") -PathType Container) "Vault template directory should exist"
    Assert-True (Test-Path -LiteralPath (Join-Path $target "repository/manifests") -PathType Container) "repository/manifests should exist"
    Assert-True ((Get-Content -LiteralPath $sentinel -Raw) -eq "user-data-must-survive") "existing user data should be unchanged"

    $manifestPath = Join-Path $target "portable-ai.manifest.json"
    Assert-True (Test-Path -LiteralPath $manifestPath -PathType Leaf) "manifest should exist"
    $manifestBefore = Get-Content -LiteralPath $manifestPath -Raw
    $reportsBefore = @(Get-ChildItem -LiteralPath (Join-Path $target "logs/initializer") -Filter "environment-check-*.json")
    Assert-True ($reportsBefore.Count -eq 1) "first run should create one environment report"
    $firstReport = $reportsBefore[0] | Get-Content -Raw | ConvertFrom-Json
    Assert-True ($firstReport.status -eq "succeeded") "first report should indicate success"
    Assert-True ($firstReport.safety.disk_formatting_performed -eq $false) "report should confirm no formatting"
    Assert-True ($firstReport.safety.symbolic_links_followed -eq $false) "report should confirm no linked paths were followed"

    $secondExitCode = Invoke-Initializer -Target $target
    Assert-True ($secondExitCode -eq 0) "second initialization should succeed"
    Assert-True ((Get-Content -LiteralPath $manifestPath -Raw) -eq $manifestBefore) "existing manifest should not be overwritten"
    Assert-True ((Get-Content -LiteralPath $sentinel -Raw) -eq "user-data-must-survive") "user data should survive repeated initialization"
    $reportsAfter = @(Get-ChildItem -LiteralPath (Join-Path $target "logs/initializer") -Filter "environment-check-*.json")
    Assert-True ($reportsAfter.Count -eq 2) "second run should create a separate environment report"

    $collisionTarget = Join-Path $testRoot "collision-target"
    New-Item -ItemType Directory -Path $collisionTarget | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $collisionTarget "runtime"), "do-not-overwrite")
    $collisionExitCode = Invoke-Initializer -Target $collisionTarget
    Assert-True ($collisionExitCode -eq 1) "a file/directory collision should be a recognizable failure"
    Assert-True ((Get-Content -LiteralPath (Join-Path $collisionTarget "runtime") -Raw) -eq "do-not-overwrite") "collision file should be preserved"
    $collisionReportFile = Get-ChildItem -LiteralPath (Join-Path $collisionTarget "logs/initializer") -Filter "environment-check-*.json" | Select-Object -First 1
    $collisionReport = $collisionReportFile | Get-Content -Raw | ConvertFrom-Json
    Assert-True ($collisionReport.status -eq "failed") "collision report should indicate failure"

    $linkTarget = Join-Path $testRoot "link-target"
    $outsideRuntime = Join-Path $testRoot "outside-runtime"
    New-Item -ItemType Directory -Path $linkTarget | Out-Null
    New-Item -ItemType Directory -Path $outsideRuntime | Out-Null
    $runtimeLink = Join-Path $linkTarget "runtime"
    $linkWasCreated = $false
    try {
        New-Item -ItemType SymbolicLink -Path $runtimeLink -Target $outsideRuntime -ErrorAction Stop | Out-Null
        $linkWasCreated = $true
    }
    catch {
        Write-Host "Symbolic-link test skipped: $($_.Exception.Message)"
    }
    if ($linkWasCreated) {
        $linkExitCode = Invoke-Initializer -Target $linkTarget
        Assert-True ($linkExitCode -eq 1) "a linked standard directory should be a recognizable failure"
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $outsideRuntime "hermes"))) "initializer should not follow a linked directory"
    }

    $filesystemRoot = [System.IO.Path]::GetPathRoot($testRoot)
    $rootExitCode = Invoke-Initializer -Target $filesystemRoot
    Assert-True ($rootExitCode -eq 2) "filesystem roots should be rejected"

    $source = Get-Content -LiteralPath $InitializerPath -Raw
    Assert-True (-not ($source -match "(?i)Format-Volume|Format-Disk|Clear-Disk|Initialize-Disk|diskpart")) "initializer must not contain disk formatting commands"

    Write-Host "Portable initializer tests passed."
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
