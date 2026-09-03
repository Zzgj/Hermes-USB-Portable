[CmdletBinding()]
param(
    [string]$LogSourcesPath,
    [string]$InitializerPath,
    [string]$WindowsLauncherPath,
    [string]$UnixLauncherPath,
    [string]$SetupScriptPath,
    [string]$EventWriterPath,
    [string]$ObservationRunnerPath,
    [string]$GitIgnorePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$testScriptPath = $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($testScriptPath)) {
    throw "Unable to determine the test script path."
}
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $testScriptPath)
$defaultPaths = @{
    LogSourcesPath = "manifests/log-sources.json"
    InitializerPath = "scripts/initialize-portable.ps1"
    WindowsLauncherPath = "launch.bat"
    UnixLauncherPath = "launch.sh"
    SetupScriptPath = "scripts/setup-windows.ps1"
    EventWriterPath = "scripts/write-portable-log-event.ps1"
    ObservationRunnerPath = "scripts/invoke-hermes-observation.ps1"
    GitIgnorePath = ".gitignore"
}
foreach ($pathName in $defaultPaths.Keys) {
    if ([string]::IsNullOrWhiteSpace((Get-Variable -Name $pathName -ValueOnly))) {
        Set-Variable -Name $pathName -Value (Join-Path $repositoryRoot $defaultPaths[$pathName])
    }
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

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("hermes-log-layout-tests-{0}" -f [Guid]::NewGuid().ToString("N"))

try {
    $catalog = Get-Content -LiteralPath $LogSourcesPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-True ($catalog.schema_version -eq 1) "log source schema should be 1"
    Assert-True ($catalog.log_root -eq "logs") "the Workbench log root should be logs"
    Assert-True ($catalog.policy.generated_data_tracked_by_git -eq $false) "generated logs should not be tracked by Git"
    Assert-True ($catalog.policy.raw_logs_safe_to_share -eq $false) "raw logs should not be declared safe to share"

    $expectedDirectories = @(
        "logs/initializer",
        "logs/launcher",
        "logs/setup",
        "logs/doctor",
        "logs/diagnostics",
        "logs/exports"
    )
    $actualDirectories = @($catalog.workbench_directories | ForEach-Object { [string]$_ })
    foreach ($directory in $expectedDirectories) {
        Assert-True ($actualDirectories -contains $directory) "log directory '$directory' should be declared"
    }

    $requiredSourceIds = @(
        "initializer-reports",
        "launcher-events",
        "setup-transcripts",
        "playwright-setup-transcripts",
        "doctor-transcripts",
        "update-observation-transcripts",
        "portable-update-receipts",
        "hermes-logs",
        "update-receipts",
        "runtime-manifest",
        "runtime-setup-receipts",
        "hermes-source-state",
        "diagnostic-exports"
    )
    $sourceIds = @($catalog.sources | ForEach-Object { [string]$_.id })
    Assert-True (($sourceIds | Select-Object -Unique).Count -eq $sourceIds.Count) "log source ids should be unique"
    foreach ($requiredSourceId in $requiredSourceIds) {
        Assert-True ($sourceIds -contains $requiredSourceId) "log source '$requiredSourceId' should be declared"
    }

    foreach ($source in $catalog.sources) {
        $sourcePath = [string]$source.path
        Assert-True (-not [System.IO.Path]::IsPathRooted($sourcePath)) "source '$($source.id)' should use a portable-relative path"
        Assert-True (-not ($sourcePath -match '(^|/)\.\.(/|$)')) "source '$($source.id)' should not escape the portable root"
        Assert-True (-not $sourcePath.Contains("\")) "source '$($source.id)' should use portable forward slashes"
        Assert-True ($source.canonical -eq $true) "source '$($source.id)' should identify its canonical location"
        Assert-True ($source.may_contain_sensitive_data -is [bool]) "source '$($source.id)' should declare its sensitivity"
    }

    $initializerSource = Get-Content -LiteralPath $InitializerPath -Raw -Encoding UTF8
    foreach ($directory in $expectedDirectories) {
        Assert-True ($initializerSource -match [regex]::Escape('"' + $directory + '"')) "initializer should create '$directory'"
    }

    $windowsSource = Get-Content -LiteralPath $WindowsLauncherPath -Raw -Encoding UTF8
    $unixSource = Get-Content -LiteralPath $UnixLauncherPath -Raw -Encoding UTF8
    $setupSource = Get-Content -LiteralPath $SetupScriptPath -Raw -Encoding UTF8
    $eventWriterSource = Get-Content -LiteralPath $EventWriterPath -Raw -Encoding UTF8
    $observationSource = Get-Content -LiteralPath $ObservationRunnerPath -Raw -Encoding UTF8
    $gitIgnoreSource = Get-Content -LiteralPath $GitIgnorePath -Raw -Encoding UTF8

    Assert-True ($windowsSource -match 'write-portable-log-event\.ps1') "Windows launcher should write structured launcher events"
    Assert-True ($windowsSource -match 'invoke-hermes-observation\.ps1') "Windows launcher should persist Doctor and update observations"
    Assert-True ($unixSource -match 'run_observation') "Unix launcher should persist observable command output"
    Assert-True ($unixSource -match 'events\.jsonl') "Unix launcher should write structured launcher events"
    Assert-True ($setupSource -match 'Start-Transcript -LiteralPath \$SetupLogPath') "Windows setup should persist a transcript"
    Assert-True ($setupSource -match 'Stop-Transcript') "Windows setup should close its transcript"
    Assert-True ($observationSource -match 'ValidateSet\("doctor", "update-check", "update-plan"\)') "observation runner should be restricted to read-only operations"
    Assert-True ($observationSource -match 'venv\\Scripts\\python\.exe') "observation runner should use the configured portable environment"
    Assert-True (-not ($observationSource -match 'update-apply')) "observation runner should not wrap the interactive update apply operation"
    Assert-True ($eventWriterSource -match 'ConvertTo-Json -Compress') "event writer should emit structured JSONL"
    Assert-True ($gitIgnoreSource -match '(?m)^/logs/\r?$') "generated central logs should remain excluded from Git"
    Assert-True ($gitIgnoreSource -match '(?m)^/data/\r?$') "Hermes private logs and state should remain excluded from Git"

    New-Item -ItemType Directory -Path $testRoot | Out-Null
    & $EventWriterPath -Root $testRoot -Component launcher -Event test-event -Status started
    & $EventWriterPath -Root $testRoot -Component launcher -Event test-event -Status succeeded
    $eventPath = Join-Path $testRoot "logs/launcher/events.jsonl"
    Assert-True (Test-Path -LiteralPath $eventPath -PathType Leaf) "event writer should create the JSONL file"
    $events = @(Get-Content -LiteralPath $eventPath -Encoding UTF8 | ForEach-Object { $_ | ConvertFrom-Json })
    Assert-True ($events.Count -eq 2) "event writer should append instead of overwriting"
    Assert-True ($events[0].status -eq "started" -and $events[1].status -eq "succeeded") "event order and status should be preserved"
    Assert-True ($events[0].PSObject.Properties.Name -notcontains "root") "launcher events should not expose the portable path"

    Write-Host "Log layout tests passed."
}
catch {
    $failureText = @(
        $_.Exception.Message
        $_.InvocationInfo.PositionMessage
        $_.ScriptStackTrace
    ) -join [Environment]::NewLine
    [Console]::Error.WriteLine("Log layout tests failed:{0}{1}", [Environment]::NewLine, $failureText)
    $annotationText = $failureText.Replace("%", "%25").Replace("`r", "%0D").Replace("`n", "%0A")
    Write-Output "::error file=tests/log-layout.Tests.ps1,title=Log layout tests failed::$annotationText"
    exit 1
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
