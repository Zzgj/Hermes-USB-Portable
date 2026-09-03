[CmdletBinding()]
param(
    [string]$RuntimeSetupStatePath,
    [string]$SetupScriptPath,
    [string]$LauncherPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$testScriptPath = $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($testScriptPath)) {
    throw "Unable to determine the test script path."
}
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $testScriptPath)
if ([string]::IsNullOrWhiteSpace($RuntimeSetupStatePath)) {
    $RuntimeSetupStatePath = Join-Path $repositoryRoot "scripts/runtime-setup-state.ps1"
}
if ([string]::IsNullOrWhiteSpace($SetupScriptPath)) {
    $SetupScriptPath = Join-Path $repositoryRoot "scripts/setup-windows.ps1"
}
if ([string]::IsNullOrWhiteSpace($LauncherPath)) {
    $LauncherPath = Join-Path $repositoryRoot "launch.bat"
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

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("hermes-runtime-setup-state-tests-" + [Guid]::NewGuid().ToString("N"))

try {
    Assert-True (Test-Path -LiteralPath $RuntimeSetupStatePath -PathType Leaf) "runtime setup state helper should exist"
    . $RuntimeSetupStatePath

    $stateDirectory = Join-Path $testRoot ".cache\runtimes\windows-x64\state"
    $userDataDirectory = Join-Path $testRoot "data\sessions"
    $knowledgeDirectory = Join-Path $testRoot "knowledge\ObsidianVault"
    New-Item -ItemType Directory -Path $stateDirectory, $userDataDirectory, $knowledgeDirectory -Force | Out-Null
    $sessionSentinel = Join-Path $userDataDirectory "keep-session.json"
    $knowledgeSentinel = Join-Path $knowledgeDirectory "keep-note.md"
    [System.IO.File]::WriteAllText($sessionSentinel, "session-data")
    [System.IO.File]::WriteAllText($knowledgeSentinel, "knowledge-data")

    Assert-True (-not (Test-SetupReceipt -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-a")) "missing receipt should not skip a setup step"

    $receiptPath = Write-SetupReceipt -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-a" -Details @{ version = "3.11" }
    Assert-True (Test-Path -LiteralPath $receiptPath -PathType Leaf) "successful step should create a receipt"
    Assert-True (Test-SetupReceipt -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-a") "matching successful receipt should be accepted"
    Assert-True (-not (Test-SetupReceipt -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-b")) "changed lock fingerprint should invalidate a receipt"
    Assert-True (@(Get-ChildItem -LiteralPath $stateDirectory -Filter ".*.tmp-*" -Force).Count -eq 0) "atomic receipt writes should not leave temporary files"

    [System.IO.File]::WriteAllText($receiptPath, '{"schema_version":1,"step_id":"python"')
    Assert-True (-not (Test-SetupReceipt -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-a")) "corrupt receipt JSON should trigger rebuild"

    Write-SetupReceipt -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-c" | Out-Null
    Assert-True (Test-SetupReceipt -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-c") "a later successful retry should replace the corrupt receipt"
    Remove-SetupReceipt -StateDirectory $stateDirectory -StepId "python"
    Assert-True (-not (Test-Path -LiteralPath $receiptPath)) "receipt removal should affect only the requested step"
    Assert-True ((Get-Content -LiteralPath $sessionSentinel -Raw) -eq "session-data") "receipt recovery should preserve session data"
    Assert-True ((Get-Content -LiteralPath $knowledgeSentinel -Raw) -eq "knowledge-data") "receipt recovery should preserve private knowledge"

    $invalidStepRejected = $false
    try {
        Get-SetupReceiptPath -StateDirectory $stateDirectory -StepId "../data" | Out-Null
    }
    catch {
        $invalidStepRejected = $true
    }
    Assert-True $invalidStepRejected "step IDs should reject path traversal"

    $setupSource = Get-Content -LiteralPath $SetupScriptPath -Raw -Encoding UTF8
    $launcherSource = Get-Content -LiteralPath $LauncherPath -Raw -Encoding UTF8
    Assert-True ($setupSource -match 'runtime-setup-state\.ps1') "setup should load the receipt helper"
    Assert-True ($setupSource -match 'Test-VerifiedSetupStep') "setup should verify receipts and installed files before skipping"
    Assert-True ($setupSource -match 'adopted_from_verified_runtime_manifest') "a previously completed runtime should be able to adopt component receipts without reinstalling"
    Assert-True ($setupSource -match 'Reusing the managed Hermes staging repository') "Hermes fetch should reuse managed staging across retries"
    Assert-True ($setupSource -match 'the managed staging repository was retained for retry') "exhausted Hermes fetch should explain that staging is retained"
    Assert-True ($setupSource -match 'Preserving user-updated Hermes source') "runtime repair should not silently downgrade a user-updated Hermes checkout"
    Assert-True ($setupSource -match 'playwright-\{0\}-\{1\}\.log') "Playwright should have an independent diagnostic log"
    Assert-True ($setupSource -match 'Invoke-LoggedPlaywrightInstall') "Playwright output should be captured rather than discarded"
    Assert-True (-not ($setupSource -match 'playwright install chromium 2>\$null')) "Playwright stderr should not be discarded"
    Assert-True ($setupSource -match 'if \(-not \$SetupSucceeded\)\s*\{\s*exit 1') "setup failures should return a nonzero process exit"
    Assert-True ($launcherSource -match 'if not exist "%RUNTIME_DIR%\\ready\.flag"') "launcher should verify ready state after setup returns"
    Assert-True ($launcherSource -match 'It may have been cancelled') "launcher should identify a cancelled or incomplete setup"
    Assert-True (-not ($launcherSource -match 'Please delete \.cache')) "launcher should not tell users to discard reusable cache"

    Write-Host "Runtime setup state tests passed."
}
catch {
    $failureText = @(
        $_.Exception.Message
        $_.InvocationInfo.PositionMessage
        $_.ScriptStackTrace
    ) -join [Environment]::NewLine
    [Console]::Error.WriteLine("Runtime setup state tests failed:{0}{1}", [Environment]::NewLine, $failureText)
    $annotationText = $failureText.Replace("%", "%25").Replace([string][char]13, "%0D").Replace([string][char]10, "%0A")
    Write-Output "::error file=tests/runtime-setup-state.Tests.ps1,title=Runtime setup state tests failed::$annotationText"
    exit 1
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
