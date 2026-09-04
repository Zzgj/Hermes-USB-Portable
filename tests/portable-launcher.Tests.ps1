[CmdletBinding()]
param(
    [string]$WindowsLauncherPath,
    [string]$UnixLauncherPath,
    [string]$SetupScriptPath,
    [string]$ObservationRunnerPath,
    [string]$UpdateWrapperPath,
    [string]$AttributesPath
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
if ([string]::IsNullOrWhiteSpace($UpdateWrapperPath)) {
    $UpdateWrapperPath = Join-Path $repositoryRoot "scripts/invoke-hermes-update.ps1"
}
if ([string]::IsNullOrWhiteSpace($AttributesPath)) {
    $AttributesPath = Join-Path $repositoryRoot ".gitattributes"
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
    $windowsBytes = [System.IO.File]::ReadAllBytes($WindowsLauncherPath)
    $bareLineFeeds = 0
    $bareCarriageReturns = 0
    for ($index = 0; $index -lt $windowsBytes.Length; $index++) {
        if ($windowsBytes[$index] -eq 10 -and ($index -eq 0 -or $windowsBytes[$index - 1] -ne 13)) {
            $bareLineFeeds++
        }
        if ($windowsBytes[$index] -eq 13 -and ($index + 1 -ge $windowsBytes.Length -or $windowsBytes[$index + 1] -ne 10)) {
            $bareCarriageReturns++
        }
    }

    $windowsSource = Get-Content -LiteralPath $WindowsLauncherPath -Raw -Encoding UTF8
    $unixSource = Get-Content -LiteralPath $UnixLauncherPath -Raw -Encoding UTF8
    $setupSource = Get-Content -LiteralPath $SetupScriptPath -Raw -Encoding UTF8
    $observationSource = Get-Content -LiteralPath $ObservationRunnerPath -Raw -Encoding UTF8
    $updateWrapperSource = Get-Content -LiteralPath $UpdateWrapperPath -Raw -Encoding UTF8
    $attributesSource = Get-Content -LiteralPath $AttributesPath -Raw -Encoding UTF8

    Assert-True ($windowsBytes -contains 10) "Windows launcher should contain line endings"
    Assert-True ($bareLineFeeds -eq 0) "Windows launcher should use CRLF instead of bare LF so cmd.exe can scan backward labels reliably"
    Assert-True ($bareCarriageReturns -eq 0) "Windows launcher should not contain bare CR line endings"
    Assert-True ($attributesSource -match '(?m)^\*\.bat[ \t]+-text(?:[ \t]|$)') ".gitattributes should preserve batch-file CRLF bytes in Git archives and raw downloads"

    Assert-True ($windowsSource -match 'set "HERMES_HOME=%PORTABLE_ROOT%\\data"') "Windows launcher should keep HERMES_HOME inside the portable data directory"
    Assert-True ($windowsSource -match '%RUNTIME_DIR%\\git\\cmd;%RUNTIME_DIR%\\git\\bin;%PATH%') "Windows launcher should expose portable Git and Git Bash to Hermes subprocesses"
    Assert-True ($windowsSource -match 'set "HERMES_GIT_BASH_PATH=%RUNTIME_DIR%\\git\\bin\\bash\.exe"') "Windows launcher should point Hermes at its portable Git Bash"
    Assert-True ($windowsSource -match 'if not exist "%RUNTIME_DIR%\\git\\bin\\bash\.exe" set "NEED_RUNTIME_SETUP=1"') "Windows launcher should repair runtimes that omit Git Bash"
    Assert-True ($unixSource -match 'HERMES_HOME="\$PORTABLE_ROOT/data"') "Unix launcher should keep HERMES_HOME inside the portable data directory"
    Assert-True ($windowsSource -match 'set "GIT_CONFIG_COUNT=2"') "Windows launcher should provide two command-scope Git safe-directory entries"
    Assert-True ($windowsSource -match 'set "GIT_CONFIG_VALUE_0=%PORTABLE_ROOT_GIT%/\.tmp/hermes-agent-source"') "Windows launcher should trust only its managed staging repository"
    Assert-True ($windowsSource -match 'set "GIT_CONFIG_VALUE_1=%PORTABLE_ROOT_GIT%/src/hermes-agent"') "Windows launcher should trust only its managed installed repository"
    Assert-True (-not ($windowsSource -match 'safe\.directory=\*|config\s+--global')) "Windows launcher should not disable Git ownership protection or mutate host-global config"

    $windowsCheck = Get-SourceSection $windowsSource '(?ms)^:adv_update_check\s*$.*?(?=^:[A-Za-z_][A-Za-z0-9_]*\s*$|\z)' "Windows read-only update-check action"
    Assert-True ($windowsCheck -match '-Operation update-check') "Windows update-check action should select the logged read-only check"
    Assert-True ($observationSource -match '@\("update", "--check"\)') "Windows observation runner should map update-check to the official read-only check"

    $windowsPlan = Get-SourceSection $windowsSource '(?ms)^:adv_update\s*$.*?(?=^:adv_update_apply\s*$)' "Windows update-plan action"
    Assert-True ($windowsPlan -match '-Operation update-plan') "Windows update action should select the logged read-only plan"
    Assert-True ($observationSource -match '@\("update", "--plan"\)') "Windows observation runner should map update-plan to the official read-only plan"
    Assert-True ($observationSource -match '\$env:PATH = \$gitDirectory \+ \[System\.IO\.Path\]::PathSeparator \+ \$env:PATH') "Windows observation runner should expose portable Git when invoked directly"
    Assert-True ($observationSource -match '\$env:HERMES_GIT_BASH_PATH = \$gitBashExecutable') "Windows observation runner should expose portable Git Bash when invoked directly"
    Assert-True ($windowsPlan -match 'choice /C YN') "Windows update action should require an explicit confirmation"
    Assert-True ($windowsPlan -match 'No update was applied') "Windows update action should identify a preflight failure as non-mutating"

    $windowsApply = Get-SourceSection $windowsSource '(?ms)^:adv_update_apply\s*$.*?(?=^:[A-Za-z_][A-Za-z0-9_]*\s*$|\z)' "Windows update-apply action"
    Assert-True ($windowsApply -match 'invoke-hermes-update\.ps1') "Windows update action should use the structured portable wrapper"
    Assert-True ($updateWrapperSource -match 'main\(\)" update(?:\s|\r|\n)') "Windows update wrapper should delegate application to the official updater"
    Assert-True ($updateWrapperSource -match '\$env:HERMES_GIT_BASH_PATH = \$gitBashExecutable') "Windows update wrapper should expose portable Git Bash when invoked directly"
    Assert-True ($windowsApply -match 'if errorlevel 1') "Windows update action should expose an official updater failure"

    $unixCheck = Get-SourceSection $unixSource '(?ms)^adv_update_check\(\) \{.*?^\}' "Unix read-only update-check action"
    Assert-True ($unixCheck -match 'hermes update --check') "Unix update-check action should call the official read-only check"

    $unixUpdate = Get-SourceSection $unixSource '(?ms)^adv_update\(\) \{.*?^\}' "Unix update action"
    Assert-True ($unixUpdate -match 'hermes update --plan') "Unix update action should show the official read-only plan"
    Assert-True ($unixUpdate -match 'read -r -p .*origin/main') "Unix update action should require an explicit confirmation"
    Assert-True ($unixUpdate -match 'run_observation diagnostics update-apply hermes update') "Unix update action should log the official updater and inspect its result"

    foreach ($updateEntryPoint in @($windowsSource, $unixSource, $updateWrapperSource)) {
        Assert-True (-not ($updateEntryPoint -match '(?:--no-backup|--yes|--force|--force-venv)')) "portable update entrypoints should not bypass official update safety controls"
    }

    Assert-True ($setupSource -match 'remote add origin \$HermesComponent\.source\.url') "Windows setup should retain the manifest-declared official Hermes origin"
    Assert-True ($setupSource -match '\.portable-source\.json') "Windows setup should record the bootstrap source state"
    Assert-True (-not ($setupSource -match 'Remove-Item\s+-LiteralPath\s+\(Join-Path\s+\$srcTemp\s+"\.git"\)')) "Windows setup should retain Git metadata required by the official updater"
    Assert-True ($setupSource -match '\$env:GIT_CONFIG_COUNT = "2"') "Windows setup should use protected command-scope Git configuration on ownership-less filesystems"
    Assert-True ($setupSource -match '\$env:GIT_CONFIG_VALUE_0 = \$GitSafeStagingDirectory') "Windows setup should trust its exact staging repository"
    Assert-True ($setupSource -match '\$env:GIT_CONFIG_VALUE_1 = \$GitSafeInstalledDirectory') "Windows setup should trust its exact installed repository"
    Assert-True (-not ($setupSource -match 'safe\.directory=\*|config\s+--global')) "Windows setup should not disable Git ownership protection or mutate host-global config"

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
