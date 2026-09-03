[CmdletBinding()]
param(
    [string]$InitializerPath,
    [string]$ComponentLockPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$testScriptPath = $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($testScriptPath)) {
    throw "Unable to determine the test script path."
}
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $testScriptPath)
if ([string]::IsNullOrWhiteSpace($InitializerPath)) {
    $InitializerPath = Join-Path $repositoryRoot "scripts/initialize-portable.ps1"
}
if ([string]::IsNullOrWhiteSpace($ComponentLockPath)) {
    $ComponentLockPath = Join-Path $repositoryRoot "manifests/runtime-components.windows-x64.json"
}

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

function ConvertTo-NativeArgument {
    param([string]$Value)

    if ($Value.Contains('"')) {
        throw "The test harness does not support a double quote in a process argument."
    }
    if ($Value -notmatch '\s') {
        return $Value
    }
    return '"{0}"' -f $Value
}

function Invoke-Initializer {
    param(
        [string]$Target,
        [string]$LockPath = $ComponentLockPath
    )

    $hostExecutable = (Get-Process -Id $PID).Path
    $initializerArgument = ConvertTo-NativeArgument -Value $InitializerPath
    $targetArgument = ConvertTo-NativeArgument -Value $Target
    $lockArgument = ConvertTo-NativeArgument -Value $LockPath
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $hostExecutable
    $startInfo.Arguments = "-NoLogo -NoProfile -File $initializerArgument -TargetDirectory $targetArgument -ComponentLockPath $lockArgument"
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    try {
        $process.Start() | Out-Null
        $standardOutputTask = $process.StandardOutput.ReadToEndAsync()
        $standardErrorTask = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        $standardOutput = $standardOutputTask.Result
        $standardError = $standardErrorTask.Result
        $exitCode = $process.ExitCode
    }
    finally {
        $process.Dispose()
    }

    if (-not [string]::IsNullOrWhiteSpace($standardOutput)) {
        Write-Host $standardOutput.TrimEnd()
    }
    if (-not [string]::IsNullOrWhiteSpace($standardError)) {
        Write-Host $standardError.TrimEnd()
    }
    return [int]$exitCode
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
    Assert-True (Test-Path -LiteralPath (Join-Path $target "logs/launcher") -PathType Container) "logs/launcher should exist"
    Assert-True (Test-Path -LiteralPath (Join-Path $target "logs/setup") -PathType Container) "logs/setup should exist"
    Assert-True (Test-Path -LiteralPath (Join-Path $target "logs/doctor") -PathType Container) "logs/doctor should exist"
    Assert-True (Test-Path -LiteralPath (Join-Path $target "logs/diagnostics") -PathType Container) "logs/diagnostics should exist"
    Assert-True (Test-Path -LiteralPath (Join-Path $target "logs/exports") -PathType Container) "logs/exports should exist"
    Assert-True ((Get-Content -LiteralPath $sentinel -Raw) -eq "user-data-must-survive") "existing user data should be unchanged"

    $manifestPath = Join-Path $target "portable-ai.manifest.json"
    Assert-True (Test-Path -LiteralPath $manifestPath -PathType Leaf) "manifest should exist"
    $manifestBefore = Get-Content -LiteralPath $manifestPath -Raw
    $manifest = $manifestBefore | ConvertFrom-Json
    $expectedLockHash = (Get-FileHash -LiteralPath $ComponentLockPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-True ($manifest.component_lock_sha256 -eq $expectedLockHash) "manifest should identify the exact component lock"
    Assert-True (@($manifest.components).Count -eq 6) "manifest should contain every locked runtime component"
    $hermesComponent = @($manifest.components | Where-Object { $_.id -eq "hermes-agent" })
    Assert-True ($hermesComponent.Count -eq 1) "manifest should contain one Hermes component"
    Assert-True ($hermesComponent[0].version -eq "0.21.0") "Hermes bootstrap version should match the audited first-install baseline"
    Assert-True ($hermesComponent[0].source.commit -eq "29112bef099274229cadff79cdff7bf7b99c4b77") "Hermes bootstrap commit should be auditable"
    Assert-True ($hermesComponent[0].version_role -eq "bootstrap") "Hermes version should be recorded as a bootstrap baseline"
    Assert-True ($hermesComponent[0].update_policy.allow_newer_than_bootstrap -eq $true) "Hermes should be updateable beyond the bootstrap version"
    $reportsBefore = @(Get-ChildItem -LiteralPath (Join-Path $target "logs/initializer") -Filter "environment-check-*.json")
    Assert-True ($reportsBefore.Count -eq 1) "first run should create one environment report"
    $firstReport = $reportsBefore[0] | Get-Content -Raw | ConvertFrom-Json
    Assert-True ($firstReport.status -eq "succeeded") "first report should indicate success"
    Assert-True ($firstReport.component_lock.sha256 -eq $expectedLockHash) "environment report should identify the exact component lock"
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

    $missingLockTarget = Join-Path $testRoot "missing-lock-target"
    $missingLockPath = Join-Path $testRoot "missing-components.json"
    $missingLockExitCode = Invoke-Initializer -Target $missingLockTarget -LockPath $missingLockPath
    Assert-True ($missingLockExitCode -eq 3) "a missing component lock should be a configuration failure"
    Assert-True (-not (Test-Path -LiteralPath $missingLockTarget)) "an invalid component lock should fail before target mutation"

    $malformedLockPath = Join-Path $testRoot "malformed-components.json"
    $malformedLock = Get-Content -LiteralPath $ComponentLockPath -Raw | ConvertFrom-Json
    $malformedLock.components[0].integrity.sha256 = "not-a-sha256"
    $malformedLockJson = $malformedLock | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($malformedLockPath, $malformedLockJson)
    $malformedLockTarget = Join-Path $testRoot "malformed-lock-target"
    $malformedLockExitCode = Invoke-Initializer -Target $malformedLockTarget -LockPath $malformedLockPath
    Assert-True ($malformedLockExitCode -eq 3) "a malformed component lock should be a configuration failure"
    Assert-True (-not (Test-Path -LiteralPath $malformedLockTarget)) "a malformed component lock should fail before target mutation"

    $filesystemRoot = [System.IO.Path]::GetPathRoot($testRoot)
    $rootExitCode = Invoke-Initializer -Target $filesystemRoot
    Assert-True ($rootExitCode -eq 2) "filesystem roots should be rejected"

    $source = Get-Content -LiteralPath $InitializerPath -Raw
    Assert-True (-not ($source -match "(?i)Format-Volume|Format-Disk|Clear-Disk|Initialize-Disk|diskpart")) "initializer must not contain disk formatting commands"

    Write-Host "Portable initializer tests passed."
}
catch {
    $failureText = @(
        $_.Exception.Message
        $_.InvocationInfo.PositionMessage
        $_.ScriptStackTrace
    ) -join [Environment]::NewLine
    [Console]::Error.WriteLine("Portable initializer tests failed:{0}{1}", [Environment]::NewLine, $failureText)

    # GitHub exposes annotations for public workflow runs even when full logs
    # require authentication. Escape the workflow-command payload so Windows
    # compatibility failures remain diagnosable without publishing artifacts.
    $annotationText = $failureText.Replace("%", "%25").Replace("`r", "%0D").Replace("`n", "%0A")
    Write-Output "::error file=tests/portable-initializer.Tests.ps1,title=Portable initializer tests failed::$annotationText"
    exit 1
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
