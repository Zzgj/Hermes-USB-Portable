[CmdletBinding()]
param(
    [string]$WindowsLauncherPath,
    [string]$UnixLauncherPath,
    [string]$SetupScriptPath,
    [string]$ObservationRunnerPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$testScriptPath = $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($testScriptPath)) {
    throw "Unable to determine the test script path."
}
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $testScriptPath)
if ([string]::IsNullOrWhiteSpace($WindowsLauncherPath)) {
    $WindowsLauncherPath = Join-Path $repositoryRoot "launch.bat"
}
if ([string]::IsNullOrWhiteSpace($UnixLauncherPath)) {
    $UnixLauncherPath = Join-Path $repositoryRoot "launch.sh"
}
if ([string]::IsNullOrWhiteSpace($SetupScriptPath)) {
    $SetupScriptPath = Join-Path $repositoryRoot "scripts/setup-windows.ps1"
}
if ([string]::IsNullOrWhiteSpace($ObservationRunnerPath)) {
    $ObservationRunnerPath = Join-Path $repositoryRoot "scripts/invoke-hermes-observation.ps1"
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

function Get-SourceSection {
    param(
        [string]$Source,
        [string]$Pattern,
        [string]$Description
    )

    $match = [regex]::Match($Source, $Pattern)
    Assert-True ($match.Success) "$Description should exist"
    return $match.Value
}

try {
    $windowsSource = Get-Content -LiteralPath $WindowsLauncherPath -Raw -Encoding UTF8
    $unixSource = Get-Content -LiteralPath $UnixLauncherPath -Raw -Encoding UTF8
    $setupSource = Get-Content -LiteralPath $SetupScriptPath -Raw -Encoding UTF8
    $observationSource = Get-Content -LiteralPath $ObservationRunnerPath -Raw -Encoding UTF8

    Assert-True ($windowsSource -match 'set "HERMES_HOME=%PORTABLE_ROOT%\\data"') "Windows launcher should keep HERMES_HOME inside the portable data directory"
    Assert-True ($unixSource -match 'HERMES_HOME="\$PORTABLE_ROOT/data"') "Unix launcher should keep HERMES_HOME inside the portable data directory"

    $windowsCheck = Get-SourceSection $windowsSource '(?ms)^:adv_update_check\s*$.*?(?=^:[A-Za-z_][A-Za-z0-9_]*\s*$|\z)' "Windows read-only update-check action"
    Assert-True ($windowsCheck -match '-Operation update-check') "Windows update-check action should select the logged read-only check"
    Assert-True ($observationSource -match '@\("update", "--check"\)') "Windows observation runner should map update-check to the official read-only check"

    $windowsPlan = Get-SourceSection $windowsSource '(?ms)^:adv_update\s*$.*?(?=^:adv_update_apply\s*$)' "Windows update-plan action"
    Assert-True ($windowsPlan -match '-Operation update-plan') "Windows update action should select the logged read-only plan"
    Assert-True ($observationSource -match '@\("update", "--plan"\)') "Windows observation runner should map update-plan to the official read-only plan"
    Assert-True ($windowsPlan -match 'choice /C YN') "Windows update action should require an explicit confirmation"
    Assert-True ($windowsPlan -match 'No update was applied') "Windows update action should identify a preflight failure as non-mutating"

    $windowsApply = Get-SourceSection $windowsSource '(?ms)^:adv_update_apply\s*$.*?(?=^:[A-Za-z_][A-Za-z0-9_]*\s*$|\z)' "Windows update-apply action"
    Assert-True ($windowsApply -match 'main\(\)" update(?:\s|\r|\n)') "Windows update action should delegate application to the official updater"
    Assert-True ($windowsApply -match 'if errorlevel 1') "Windows update action should expose an official updater failure"

    $unixCheck = Get-SourceSection $unixSource '(?ms)^adv_update_check\(\) \{.*?^\}' "Unix read-only update-check action"
    Assert-True ($unixCheck -match 'hermes update --check') "Unix update-check action should call the official read-only check"

    $unixUpdate = Get-SourceSection $unixSource '(?ms)^adv_update\(\) \{.*?^\}' "Unix update action"
    Assert-True ($unixUpdate -match 'hermes update --plan') "Unix update action should show the official read-only plan"
    Assert-True ($unixUpdate -match 'read -r -p .*origin/main') "Unix update action should require an explicit confirmation"
    Assert-True ($unixUpdate -match 'if hermes update; then') "Unix update action should delegate application to the official updater and inspect its result"

    foreach ($launcher in @($windowsSource, $unixSource)) {
        Assert-True (-not ($launcher -match '(?:--no-backup|--yes|--force|--force-venv)')) "portable launchers should not bypass official update safety controls"
    }

    Assert-True ($setupSource -match 'remote add origin \$HermesComponent\.source\.url') "Windows setup should retain the manifest-declared official Hermes origin"
    Assert-True ($setupSource -match '\.portable-source\.json') "Windows setup should record the bootstrap source state"
    Assert-True (-not ($setupSource -match 'Remove-Item\s+-LiteralPath\s+\(Join-Path\s+\$srcTemp\s+"\.git"\)')) "Windows setup should retain Git metadata required by the official updater"

    Write-Host "Portable launcher tests passed."
}
catch {
    $failureText = @(
        $_.Exception.Message
        $_.InvocationInfo.PositionMessage
        $_.ScriptStackTrace
    ) -join [Environment]::NewLine
    [Console]::Error.WriteLine("Portable launcher tests failed:{0}{1}", [Environment]::NewLine, $failureText)
    $annotationText = $failureText.Replace("%", "%25").Replace("`r", "%0D").Replace("`n", "%0A")
    Write-Output "::error file=tests/portable-launcher.Tests.ps1,title=Portable launcher tests failed::$annotationText"
    exit 1
}
