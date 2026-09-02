[CmdletBinding()]
param(
    [string]$ComponentLockPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "manifests/runtime-components.windows-x64.json"),
    [string]$SetupScriptPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts/setup-windows.ps1")
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

try {
    $lock = Get-Content -LiteralPath $ComponentLockPath -Raw | ConvertFrom-Json
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

    $setupSource = Get-Content -LiteralPath $SetupScriptPath -Raw
    Assert-True ($setupSource -match 'runtime-components\.windows-x64\.json') "setup should consume the component lock"
    Assert-True ($setupSource -match 'Assert-ArchiveIntegrity') "setup should verify downloaded archives"
    Assert-True ($setupSource -match 'HermesComponent\.source\.commit') "setup should verify the Hermes commit"
    Assert-True ($setupSource -match '\.portable-source\.json') "setup should record the installed Hermes source state"
    Assert-True ($setupSource -match 'runtime-manifest\.json') "setup should record the installed runtime state"
    Assert-True ($setupSource -match '\[System\.IO\.File\]::WriteAllText\(\$readyFlag, \(\$ComponentLockHash') "ready state should identify the installed component lock"
    Assert-True ($setupSource -match 'Get-ChildItem -Path \$CacheDir, \$SrcDir, \$TempDir') "metadata cleanup should stay inside setup-managed directories"
    Assert-True (-not ($setupSource -match 'Get-ChildItem -Path \$Root -Filter "\._\*"')) "setup should not recursively delete metadata files from user-owned root content"
    Assert-True (-not ($setupSource -match 'archive/refs/heads/main|anthropic>=0\.39\.0|telegram-bot\[webhooks\]==22\.6')) "setup should not use removed floating or stale pins"

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
