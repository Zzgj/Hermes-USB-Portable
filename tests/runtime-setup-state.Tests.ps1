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

    $script:SetupVerificationCalls = 0
    $healthyVerification = {
        $script:SetupVerificationCalls++
        return $true
    }
    Assert-True (Test-SetupStepReady -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-a" -Verification $healthyVerification) "matching receipt and live verification should skip the step"
    Assert-True ($script:SetupVerificationCalls -eq 1) "live verification should run exactly once for a matching receipt"
    Assert-True (-not (Test-SetupStepReady -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-b" -Verification $healthyVerification)) "a fingerprint mismatch should not skip"
    Assert-True ($script:SetupVerificationCalls -eq 1) "a fingerprint mismatch should not execute the installed component"

    $failedVerification = { return $false }
    Assert-True (-not (Test-SetupStepReady -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-a" -Verification $failedVerification)) "failed installed verification should rebuild the step"
    Assert-True (-not (Test-Path -LiteralPath $receiptPath)) "failed installed verification should invalidate its stale receipt"

    Write-SetupReceipt -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-noisy" | Out-Null
    $noisyVerification = {
        Write-Output "unexpected diagnostic output"
        return $true
    }
    Assert-True (-not (Test-SetupStepReady -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-noisy" -Verification $noisyVerification)) "ambiguous verification output should fail closed"
    Assert-True (-not (Test-Path -LiteralPath $receiptPath)) "ambiguous verification should invalidate its receipt"

    Write-SetupReceipt -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-a" | Out-Null
    [System.IO.File]::WriteAllText($receiptPath, '{"schema_version":1,"step_id":"python"')
    Assert-True (-not (Test-SetupReceipt -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-a")) "corrupt receipt JSON should trigger rebuild"

    Write-SetupReceipt -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-c" | Out-Null
    Assert-True (Test-SetupReceipt -StateDirectory $stateDirectory -StepId "python" -Fingerprint "sha-c") "a later successful retry should replace the corrupt receipt"
    Remove-SetupReceipt -StateDirectory $stateDirectory -StepId "python"
    Assert-True (-not (Test-Path -LiteralPath $receiptPath)) "receipt removal should affect only the requested step"
    Assert-True ((Get-Content -LiteralPath $sessionSentinel -Raw) -eq "session-data") "receipt recovery should preserve session data"
    Assert-True ((Get-Content -LiteralPath $knowledgeSentinel -Raw) -eq "knowledge-data") "receipt recovery should preserve private knowledge"

    $runtimeDirectory = Join-Path $testRoot ".cache\runtimes\windows-x64"
    $sourceDirectory = Join-Path $testRoot "src\hermes-agent"
    New-Item -ItemType Directory -Path $sourceDirectory -Force | Out-Null
    $componentLockHash = "a" * 64
    $sourceState = [ordered]@{
        schema_version = 1
        version = "0.21.0"
        version_role = "bootstrap"
        ref = "v0.21.0"
        commit = "b" * 40
        update_policy = [ordered]@{ allow_newer_than_bootstrap = $true }
        component_lock_sha256 = $componentLockHash
    }
    $legacySourceStatePath = Join-Path $sourceDirectory ".portable-source.json"
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($legacySourceStatePath, (($sourceState | ConvertTo-Json -Depth 8) + [Environment]::NewLine), $utf8WithoutBom)
    Assert-True (Move-LegacyHermesSourceState -SourceDirectory $sourceDirectory -RuntimeDirectory $runtimeDirectory -ExpectedComponentLockHash $componentLockHash) "valid legacy source state should migrate"
    $sourceStatePath = Get-HermesSourceStatePath -RuntimeDirectory $runtimeDirectory
    Assert-True (Test-HermesSourceStateFile -Path $sourceStatePath -ExpectedComponentLockHash $componentLockHash) "canonical Runtime-owned source state should validate"
    Assert-True (-not (Test-HermesSourceStateFile -Path $sourceStatePath -ExpectedComponentLockHash $componentLockHash -ExpectedCommit ("c" * 40))) "source state should not validate against a different installed commit"
    Assert-True (-not (Test-Path -LiteralPath $legacySourceStatePath)) "legacy source state should leave the upstream worktree"
    Assert-True (@(Get-ChildItem -LiteralPath $runtimeDirectory -Filter ".hermes-source.tmp-*" -Force).Count -eq 0) "atomic source-state writes should not leave temporary files"

    Remove-Item -LiteralPath $sourceStatePath -Force
    [System.IO.File]::WriteAllText($legacySourceStatePath, '{"schema_version":1}', $utf8WithoutBom)
    Assert-True (Move-LegacyHermesSourceState -SourceDirectory $sourceDirectory -RuntimeDirectory $runtimeDirectory -ExpectedComponentLockHash $componentLockHash -FallbackSourceState $sourceState) "verified Runtime state should replace a stale legacy source state"
    Assert-True (Test-HermesSourceStateFile -Path $sourceStatePath -ExpectedComponentLockHash $componentLockHash) "replacement source state should validate"
    Assert-True (-not (Test-Path -LiteralPath $legacySourceStatePath)) "stale legacy source state should be removed after verified replacement"

    $gitCommand = Get-Command git -ErrorAction SilentlyContinue
    if ($null -ne $gitCommand) {
        $collisionRepository = Join-Path $testRoot "case-collision-repository"
        New-Item -ItemType Directory -Path $collisionRepository -Force | Out-Null
        & $gitCommand.Source -c init.defaultBranch=main -C $collisionRepository init --quiet
        Assert-True ($LASTEXITCODE -eq 0) "case-collision fixture repository should initialize"
        $blobHash = ("portable-test" | & $gitCommand.Source -C $collisionRepository hash-object -w --stdin).Trim()
        Assert-True ($LASTEXITCODE -eq 0 -and $blobHash -match '^[0-9a-fA-F]{40,64}$') "case-collision fixture blob should be stored"
        $upperCollisionPath = "contributors/emails/agent@Agents-Mac-mini.local"
        $lowerCollisionPath = "contributors/emails/agent@agents-Mac-mini.local"
        & $gitCommand.Source -C $collisionRepository update-index --add --cacheinfo "100644,$blobHash,$upperCollisionPath"
        Assert-True ($LASTEXITCODE -eq 0) "uppercase collision fixture should enter the index"
        & $gitCommand.Source -C $collisionRepository update-index --add --cacheinfo "100644,$blobHash,$lowerCollisionPath"
        Assert-True ($LASTEXITCODE -eq 0) "lowercase collision fixture should enter the index"
        Assert-True (Set-HermesCaseCollisionWorkaround -GitExecutable $gitCommand.Source -SourceDirectory $collisionRepository) "exact upstream collision should activate the bounded workaround"
        $collisionIndex = @(& $gitCommand.Source -C $collisionRepository ls-files -v -- $upperCollisionPath $lowerCollisionPath)
        Assert-True (@($collisionIndex | Where-Object { $_ -match '^S ' }).Count -eq 2) "both exact collision entries should be marked skip-worktree"

        & $gitCommand.Source -C $collisionRepository update-index --no-skip-worktree -- $upperCollisionPath $lowerCollisionPath
        & $gitCommand.Source -C $collisionRepository update-index --force-remove -- $lowerCollisionPath
        & $gitCommand.Source -C $collisionRepository update-index --skip-worktree -- $upperCollisionPath
        Assert-True (-not (Set-HermesCaseCollisionWorkaround -GitExecutable $gitCommand.Source -SourceDirectory $collisionRepository)) "a removed upstream collision should retire the workaround"
        $survivorIndex = @(& $gitCommand.Source -C $collisionRepository ls-files -v -- $upperCollisionPath)
        Assert-True ($survivorIndex.Count -eq 1 -and $survivorIndex[0] -match '^H ') "the surviving path should no longer be hidden"
    }

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
    Assert-True ($setupSource -match 'Move-LegacyHermesSourceState') "setup should migrate legacy source state out of the upstream worktree"
    Assert-True ($setupSource -match 'Set-HermesCaseCollisionWorkaround') "setup should normalize the reviewed upstream case collision"
    Assert-True (-not ($setupSource -match 'Join-Path\s+\$srcTemp\s+"\.portable-source\.json"')) "new setup should not write Portable metadata into the upstream worktree"
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
