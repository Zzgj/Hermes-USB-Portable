[CmdletBinding()]
param(
    [string]$ComponentLockPath,
    [string]$SetupScriptPath,
    [string]$RuntimeFilesystemPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$testScriptPath = $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($testScriptPath)) {
    throw "Unable to determine the test script path."
}
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $testScriptPath)
if ([string]::IsNullOrWhiteSpace($ComponentLockPath)) {
    $ComponentLockPath = Join-Path $repositoryRoot "manifests/runtime-components.windows-x64.json"
}
if ([string]::IsNullOrWhiteSpace($SetupScriptPath)) {
    $SetupScriptPath = Join-Path $repositoryRoot "scripts/setup-windows.ps1"
}
if ([string]::IsNullOrWhiteSpace($RuntimeFilesystemPath)) {
    $RuntimeFilesystemPath = Join-Path $repositoryRoot "scripts/runtime-filesystem.ps1"
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

try {
    $lock = Get-Content -LiteralPath $ComponentLockPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-True ($lock.schema_version -eq 1) "component lock schema should be 1"
    Assert-True ($lock.platform -eq "windows-x64") "component lock platform should be windows-x64"

    $requiredIds = @("python", "node", "uv", "ripgrep", "mingit", "hermes-agent")
    $componentIds = @($lock.components | ForEach-Object { [string]$_.id })
    Assert-True ($componentIds.Count -eq $requiredIds.Count) "component lock should contain exactly the required components"
    foreach ($requiredId in $requiredIds) {
        Assert-True (@($componentIds | Where-Object { $_ -eq $requiredId }).Count -eq 1) "component '$requiredId' should appear exactly once"
    }

    foreach ($component in $lock.components) {
        Assert-True (-not [string]::IsNullOrWhiteSpace([string]$component.version)) "component '$($component.id)' should have a version"
        if ($component.source.type -eq "archive") {
            Assert-True ([string]$component.source.url -match '^https://') "component '$($component.id)' should use HTTPS"
            Assert-True ([int64]$component.source.size_bytes -gt 0) "component '$($component.id)' should have a positive size"
            Assert-True ([string]$component.integrity.sha256 -match '^[0-9a-f]{64}$') "component '$($component.id)' should have a SHA-256"
        }
        elseif ($component.source.type -eq "git") {
            Assert-True ([string]$component.source.url -match '^https://') "Git component '$($component.id)' should use HTTPS"
            Assert-True ([string]$component.source.commit -match '^[0-9a-f]{40}$') "Git component '$($component.id)' should pin a commit"
            Assert-True (-not [string]::IsNullOrWhiteSpace([string]$component.source.ref)) "Git component '$($component.id)' should pin a ref"
        }
        else {
            throw "Unsupported component source type: $($component.source.type)"
        }
    }

    $requirements = @($lock.supplemental_python_packages | ForEach-Object { [string]$_.requirement })
    Assert-True ($requirements.Count -eq 2) "component lock should contain exactly the supported supplemental package pins"
    Assert-True ($requirements -contains "anthropic==0.87.0") "Anthropic package should match the pinned Hermes source"
    Assert-True ($requirements -contains "python-telegram-bot[webhooks]==22.8") "Telegram package should match the pinned Hermes source"

    $hermes = @($lock.components | Where-Object { $_.id -eq "hermes-agent" })[0]
    Assert-True ($hermes.version_role -eq "bootstrap") "Hermes version should be an initial bootstrap baseline, not a permanent ceiling"
    Assert-True ($hermes.update_policy.mode -eq "user_initiated") "Hermes updates should require an explicit user action"
    Assert-True ($hermes.update_policy.official_command -eq "hermes update") "Hermes should use its official updater"
    Assert-True ($hermes.update_policy.default_channel -eq "main") "Hermes should preserve the official updater's main channel"
    Assert-True ($hermes.update_policy.stable_release_bootstrap -eq $true) "Hermes first install should use an audited stable release"
    Assert-True ($hermes.update_policy.check_before_apply -eq $true) "Hermes updates should run a read-only update check first"
    Assert-True ($hermes.update_policy.plan_before_apply -eq $true) "Hermes updates should show the read-only fleet plan first"
    Assert-True ($hermes.update_policy.upstream_backup_mode -eq "quick") "Hermes should retain its upstream default quick snapshot"
    Assert-True ($hermes.update_policy.receipt_path_under_hermes_home -eq "logs/update_receipts") "Hermes update receipts should stay under portable HERMES_HOME"
    Assert-True ($hermes.update_policy.implementation_status -eq "in_progress") "Hermes update wrapping should remain visibly in progress until verified"
    Assert-True ($hermes.update_policy.allow_newer_than_bootstrap -eq $true) "Hermes should be allowed to update beyond the bootstrap version"
    Assert-True ($hermes.update_policy.preserve_user_data -eq $true) "Hermes updates should preserve user data"
    Assert-True ($hermes.update_policy.rollback_required -eq $true) "Hermes update design should require rollback support"

    $setupSource = Get-Content -LiteralPath $SetupScriptPath -Raw -Encoding UTF8
    $filesystemSource = Get-Content -LiteralPath $RuntimeFilesystemPath -Raw -Encoding UTF8
    Assert-True ($setupSource -match 'runtime-components\.windows-x64\.json') "setup should consume the component lock"
    Assert-True ($setupSource -match 'runtime-filesystem\.ps1') "setup should consume the removable-drive-safe filesystem helper"
    Assert-True ($setupSource -match 'Assert-ArchiveIntegrity') "setup should verify downloaded archives"
    Assert-True ($setupSource -match 'HermesComponent\.source\.commit') "setup should verify the Hermes commit"
    Assert-True ($setupSource -match '\.portable-source\.json') "setup should record the installed Hermes source state"
    Assert-True (-not ($setupSource -match 'Remove-Item\s+-LiteralPath\s+\(Join-Path\s+\$srcTemp\s+"\.git"\)')) "setup should keep Git metadata required by the inherited Hermes updater"
    Assert-True ($setupSource -match 'runtime-manifest\.json') "setup should record the installed runtime state"
    Assert-True ($setupSource -match 'hermes_version\s*=\s*\$actualHermesVersion') "runtime state should include the actual installed Hermes version"
    Assert-True ($setupSource -match 'hermes_update_channel\s*=\s*"origin/\{0\}"') "runtime state should include the configured Hermes update channel"
    Assert-True ($setupSource -match '\[System\.IO\.File\]::WriteAllText\(\$readyFlag, \(\$ComponentLockHash') "ready state should identify the installed component lock"
    Assert-True ($setupSource -match 'Get-ChildItem -Path \$CacheDir, \$SrcDir, \$TempDir') "metadata cleanup should stay inside setup-managed directories"
    Assert-True (-not ($setupSource -match 'Get-ChildItem -Path \$Root -Filter "\._\*"')) "setup should not recursively delete metadata files from user-owned root content"
    Assert-True (-not ($setupSource -match 'archive/refs/heads/main|anthropic>=0\.39\.0|telegram-bot\[webhooks\]==22\.6')) "setup should not use removed floating or stale pins"
    Assert-True ($filesystemSource -match 'Invoke-DirectoryMoveWithRetry') "runtime installs should retry transient directory move failures"
    Assert-True ($filesystemSource -match 'Copy-StagedDirectory') "runtime installs should have a copy fallback"
    Assert-True ($filesystemSource -match 'Copy fallback file-count mismatch') "copy fallback should verify the installed file set"
    Assert-True ($filesystemSource -match 'Copy fallback SHA-256 mismatch') "copy fallback should verify file content"
    Assert-True ($filesystemSource -match 'HRESULT') "runtime move failures should report diagnostic exception details"
    Assert-True ($setupSource -match 'Complete-SetupStep "uv"') "setup should verify uv and write its success receipt after installation"
    Assert-True ($setupSource -match '\$env:GIT_CONFIG_KEY_0 = "safe\.directory"') "setup should declare Git safe directories through command-scope environment configuration"
    Assert-True (-not ($setupSource -match 'safe\.directory=\*|config\s+--global')) "setup should never trust all repositories or modify host-global Git configuration"
    Assert-True ($setupSource -match '\$gitFetchAttempts = 4') "Hermes source fetch should retry bounded network failures"
    Assert-True ($setupSource -match 'Failed to fetch Hermes ref .* after \$gitFetchAttempts attempts') "Hermes source fetch should expose exhausted retries"

    Write-Host "Runtime component lock tests passed."
}
catch {
    $failureText = @(
        $_.Exception.Message
        $_.InvocationInfo.PositionMessage
        $_.ScriptStackTrace
    ) -join [Environment]::NewLine
    [Console]::Error.WriteLine("Runtime component lock tests failed:{0}{1}", [Environment]::NewLine, $failureText)
    $annotationText = $failureText.Replace("%", "%25").Replace("`r", "%0D").Replace("`n", "%0A")
    Write-Output "::error file=tests/runtime-component-lock.Tests.ps1,title=Runtime component lock tests failed::$annotationText"
    exit 1
}
