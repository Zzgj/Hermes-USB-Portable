[CmdletBinding()]
param(
    [string]$RuntimeFilesystemPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$testScriptPath = $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($testScriptPath)) {
    throw "Unable to determine the test script path."
}
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $testScriptPath)
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

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("hermes-runtime-filesystem-tests-" + [Guid]::NewGuid().ToString("N"))

try {
    Assert-True (Test-Path -LiteralPath $RuntimeFilesystemPath -PathType Leaf) "runtime filesystem helper should exist"
    . $RuntimeFilesystemPath
    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null

    $moveSource = Join-Path $testRoot "move-source"
    $moveDestination = Join-Path $testRoot "move-destination"
    $moveNested = Join-Path $moveSource "bin"
    New-Item -ItemType Directory -Path $moveNested -Force | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $moveNested "tool.exe"), "move-payload")

    $moveInstallArguments = @{
        Source = $moveSource
        Destination = $moveDestination
        MoveAttempts = 2
        InitialDelayMilliseconds = 1
    }
    Install-StagedDirectory @moveInstallArguments
    Assert-True (-not (Test-Path -LiteralPath $moveSource)) "successful move should consume the staged source"
    Assert-True (Test-Path -LiteralPath (Join-Path $moveDestination "bin/tool.exe") -PathType Leaf) "successful move should install nested files"

    $copySource = Join-Path $testRoot "copy-source"
    $copyDestination = Join-Path $testRoot "runtime"
    $copyNested = Join-Path $copySource "nested"
    $copyEmpty = Join-Path $copySource "empty"
    New-Item -ItemType Directory -Path $copyNested -Force | Out-Null
    New-Item -ItemType Directory -Path $copyEmpty -Force | Out-Null
    New-Item -ItemType Directory -Path $copyDestination -Force | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $copySource "uv.exe"), "portable-uv")
    [System.IO.File]::WriteAllText((Join-Path $copyNested ".state"), "state")
    [System.IO.File]::WriteAllText((Join-Path $copyDestination "old-runtime.txt"), "old")

    $script:ForcedMoveSource = [System.IO.Path]::GetFullPath($copySource)
    $script:ForcedMoveAttempts = 0
    $forcedMoveOperation = {
        param($OperationSource, $OperationDestination)

        $operationSourcePath = [System.IO.Path]::GetFullPath($OperationSource)
        if ([string]::Equals($operationSourcePath, $script:ForcedMoveSource, [StringComparison]::OrdinalIgnoreCase)) {
            $script:ForcedMoveAttempts++
            throw "forced removable-drive move failure"
        }
        Move-Item -LiteralPath $OperationSource -Destination $OperationDestination -ErrorAction Stop
    }

    $copyInstallArguments = @{
        Source = $copySource
        Destination = $copyDestination
        MoveAttempts = 2
        InitialDelayMilliseconds = 1
        MoveOperation = $forcedMoveOperation
    }
    Install-StagedDirectory @copyInstallArguments
    Assert-True ($script:ForcedMoveAttempts -eq 2) "move failure should be retried before fallback"
    Assert-True (Test-Path -LiteralPath $copySource -PathType Container) "copy fallback should retain the staged source until final cleanup"
    Assert-True (Test-Path -LiteralPath (Join-Path $copyDestination "uv.exe") -PathType Leaf) "copy fallback should install top-level files"
    Assert-True (Test-Path -LiteralPath (Join-Path $copyDestination "nested/.state") -PathType Leaf) "copy fallback should include hidden nested files"
    Assert-True (Test-Path -LiteralPath (Join-Path $copyDestination "empty") -PathType Container) "copy fallback should include empty directories"
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $copyDestination "old-runtime.txt"))) "copy fallback should replace the prior runtime"
    $backupDirectories = @(Get-ChildItem -LiteralPath $testRoot -Directory -Filter "runtime.backup-*" -ErrorAction Stop)
    Assert-True ($backupDirectories.Count -eq 0) "successful fallback should remove the previous runtime backup"

    Write-Host "Runtime filesystem tests passed."
}
catch {
    $failureText = @(
        $_.Exception.Message
        $_.InvocationInfo.PositionMessage
        $_.ScriptStackTrace
    ) -join [Environment]::NewLine
    [Console]::Error.WriteLine("Runtime filesystem tests failed:{0}{1}", [Environment]::NewLine, $failureText)
    $annotationText = $failureText.Replace("%", "%25").Replace([string][char]13, "%0D").Replace([string][char]10, "%0A")
    Write-Output "::error file=tests/runtime-filesystem.Tests.ps1,title=Runtime filesystem tests failed::$annotationText"
    exit 1
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
