[CmdletBinding()]
param(
    [string]$ResetScriptPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$testScriptPath = $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($testScriptPath)) {
    throw "Unable to determine the test script path."
}
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $testScriptPath)
if ([string]::IsNullOrWhiteSpace($ResetScriptPath)) {
    $ResetScriptPath = Join-Path $repositoryRoot "scripts/reset-windows.ps1"
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

function New-ResetFixture {
    param(
        [string]$FixtureRoot
    )

    $fixtureScriptDirectory = Join-Path $FixtureRoot "scripts"
    New-Item -ItemType Directory -Path $fixtureScriptDirectory -Force | Out-Null
    Copy-Item -LiteralPath $ResetScriptPath -Destination (Join-Path $fixtureScriptDirectory "reset-windows.ps1") -Force
    [System.IO.File]::WriteAllText((Join-Path $FixtureRoot "launch.bat"), "@echo off")

    $directories = @(
        ".cache/runtimes/component",
        "src/hermes-agent",
        "data/sessions",
        "knowledge/ObsidianVault/00-Inbox",
        "logs/diagnostics"
    )
    foreach ($relativeDirectory in $directories) {
        New-Item -ItemType Directory -Path (Join-Path $FixtureRoot $relativeDirectory) -Force | Out-Null
    }

    $files = [ordered]@{
        ".cache/runtimes/component/runtime.bin" = "runtime"
        "src/hermes-agent/source.txt" = "source"
        "data/.env" = "TEST_KEY=not-a-secret"
        "data/config.yaml" = "model: test"
        "data/sessions/sentinel.txt" = "session"
        "data/auth.lock" = "lock"
        "knowledge/ObsidianVault/00-Inbox/sentinel.txt" = "knowledge"
        "logs/diagnostics/sentinel.txt" = "diagnostic"
    }
    foreach ($entry in $files.GetEnumerator()) {
        [System.IO.File]::WriteAllText((Join-Path $FixtureRoot $entry.Key), $entry.Value)
    }

    return (Join-Path $fixtureScriptDirectory "reset-windows.ps1")
}

function Invoke-ResetFixture {
    param(
        [string]$ScriptPath,
        [AllowNull()]
        [object]$Confirmation
    )

    $hostExecutable = (Get-Process -Id $PID).Path
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $hostExecutable
    $startInfo.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" -Mode soft"
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    Assert-True ($process.Start()) "reset fixture process should start"
    if ($null -ne $Confirmation) {
        $process.StandardInput.WriteLine($Confirmation)
        $process.StandardInput.Close()
    }
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        Stdout = $stdout
        Stderr = $stderr
    }
}

$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("hermes-reset-tests-" + [Guid]::NewGuid().ToString("N"))

try {
    $resetSource = Get-Content -LiteralPath $ResetScriptPath -Raw -Encoding UTF8
    $confirmPosition = $resetSource.IndexOf('$confirm = Read-Host', [System.StringComparison]::Ordinal)
    $stopPosition = $resetSource.LastIndexOf('Stop-PortableGateway -PortableRoot $Root', [System.StringComparison]::Ordinal)

    Assert-True ($resetSource -match 'function Test-CommandLineBelongsToPortableRoot') "reset should define an exact portable-root command-line check"
    Assert-True ($resetSource -match 'Refusing to reset a directory that is not a Hermes Portable root') "reset should reject a non-Portable root"
    Assert-True ($resetSource -match 'IndexOf\(\$rootPrefix, \[System\.StringComparison\]::OrdinalIgnoreCase\)') "gateway ownership should use a case-insensitive exact root prefix"
    Assert-True ($resetSource -match 'Get-CimInstance -ClassName Win32_Process') "reset should inspect process command lines before stopping a gateway"
    Assert-True (-not ($resetSource -match 'Get-Process\s*\|\s*Where-Object')) "reset should not scan and terminate every host Hermes or Python process"
    Assert-True ($confirmPosition -ge 0 -and $stopPosition -gt $confirmPosition) "gateway shutdown must happen only after destructive confirmation"
    Assert-True ($resetSource -match '\$Root\\knowledge\\') "soft-reset output should state that knowledge is preserved"
    Assert-True ($resetSource -match '\$Root\\logs\\') "soft-reset output should state that diagnostics are preserved"

    $runningOnWindows = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT
    if ($runningOnWindows) {
        $cancelRoot = Join-Path $temporaryRoot "cancel"
        $cancelScript = New-ResetFixture -FixtureRoot $cancelRoot
        $cancelResult = Invoke-ResetFixture -ScriptPath $cancelScript -Confirmation "no"
        Assert-True ($cancelResult.ExitCode -eq 0) "cancelled soft reset should exit successfully"
        Assert-True ($cancelResult.Stdout -match 'Cancelled\. Nothing was deleted\.') "cancelled soft reset should report no mutation"
        Assert-True (Test-Path -LiteralPath (Join-Path $cancelRoot ".cache/runtimes/component/runtime.bin") -PathType Leaf) "cancel should preserve the runtime"
        Assert-True (Test-Path -LiteralPath (Join-Path $cancelRoot "src/hermes-agent/source.txt") -PathType Leaf) "cancel should preserve source"
        Assert-True (Test-Path -LiteralPath (Join-Path $cancelRoot "data/auth.lock") -PathType Leaf) "cancel should not remove the gateway lock"

        $softRoot = Join-Path $temporaryRoot "soft"
        $softScript = New-ResetFixture -FixtureRoot $softRoot
        $softResult = Invoke-ResetFixture -ScriptPath $softScript -Confirmation "yes"
        Assert-True ($softResult.ExitCode -eq 0) "confirmed soft reset should exit successfully: $($softResult.Stderr)"
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $softRoot ".cache/runtimes"))) "soft reset should delete runtimes"
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $softRoot "src/hermes-agent"))) "soft reset should delete Hermes source"
        Assert-True (Test-Path -LiteralPath (Join-Path $softRoot "data/.env") -PathType Leaf) "soft reset should preserve secrets"
        Assert-True (Test-Path -LiteralPath (Join-Path $softRoot "data/config.yaml") -PathType Leaf) "soft reset should preserve configuration"
        Assert-True (Test-Path -LiteralPath (Join-Path $softRoot "data/sessions/sentinel.txt") -PathType Leaf) "soft reset should preserve sessions"
        Assert-True (Test-Path -LiteralPath (Join-Path $softRoot "knowledge/ObsidianVault/00-Inbox/sentinel.txt") -PathType Leaf) "soft reset should preserve knowledge"
        Assert-True (Test-Path -LiteralPath (Join-Path $softRoot "logs/diagnostics/sentinel.txt") -PathType Leaf) "soft reset should preserve diagnostics"
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $softRoot "data/auth.lock"))) "confirmed reset should remove only its own portable gateway lock"

        $invalidRoot = Join-Path $temporaryRoot "invalid"
        $invalidScriptDirectory = Join-Path $invalidRoot "scripts"
        New-Item -ItemType Directory -Path $invalidScriptDirectory -Force | Out-Null
        $invalidScript = Join-Path $invalidScriptDirectory "reset-windows.ps1"
        Copy-Item -LiteralPath $ResetScriptPath -Destination $invalidScript -Force
        $invalidResult = Invoke-ResetFixture -ScriptPath $invalidScript -Confirmation $null
        Assert-True ($invalidResult.ExitCode -ne 0) "reset should reject a directory without the Portable root marker"
        Assert-True ($invalidResult.Stderr -match 'not a Hermes Portable root') "invalid-root rejection should be explicit"
    }
    else {
        Write-Host "Reset behavior test skipped: Windows is required."
    }

    Write-Host "Windows reset tests passed."
}
catch {
    $failureText = @(
        $_.Exception.Message
        $_.InvocationInfo.PositionMessage
        $_.ScriptStackTrace
    ) -join [Environment]::NewLine
    [Console]::Error.WriteLine("Windows reset tests failed:{0}{1}", [Environment]::NewLine, $failureText)
    $annotationText = $failureText.Replace("%", "%25").Replace("`r", "%0D").Replace("`n", "%0A")
    Write-Output "::error file=tests/reset-windows.Tests.ps1,title=Windows reset tests failed::$annotationText"
    exit 1
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
