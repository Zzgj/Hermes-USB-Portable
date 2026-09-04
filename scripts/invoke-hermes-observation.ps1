[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Root,

    [Parameter(Mandatory = $true)]
    [ValidateSet("doctor", "update-check", "update-plan")]
    [string]$Operation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$rootPath = [System.IO.Path]::GetFullPath($Root)
$runtimeDirectory = Join-Path $rootPath ".cache\runtimes\windows-x64"
$pythonExecutable = Join-Path $runtimeDirectory "venv\Scripts\python.exe"
$gitDirectory = Join-Path $runtimeDirectory "git\cmd"
$gitExecutable = Join-Path $gitDirectory "git.exe"
$sourceDirectory = Join-Path $rootPath "src\hermes-agent"
if (-not (Test-Path -LiteralPath $pythonExecutable -PathType Leaf)) {
    throw "Portable Python executable not found: $pythonExecutable"
}
if (-not (Test-Path -LiteralPath $sourceDirectory -PathType Container)) {
    throw "Hermes source directory not found: $sourceDirectory"
}
if (-not (Test-Path -LiteralPath $gitExecutable -PathType Leaf)) {
    throw "Portable Git executable not found: $gitExecutable"
}

$env:HERMES_HOME = Join-Path $rootPath "data"
$env:PATH = $gitDirectory + [System.IO.Path]::PathSeparator + $env:PATH

switch ($Operation) {
    "doctor" {
        $category = "doctor"
        $filePrefix = "doctor"
        $hermesArguments = @("doctor")
    }
    "update-check" {
        $category = "diagnostics"
        $filePrefix = "update-check"
        $hermesArguments = @("update", "--check")
    }
    "update-plan" {
        $category = "diagnostics"
        $filePrefix = "update-plan"
        $hermesArguments = @("update", "--plan")
    }
}

$logDirectory = Join-Path (Join-Path $rootPath "logs") $category
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$stamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
$suffix = [Guid]::NewGuid().ToString("N").Substring(0, 8)
$logPath = Join-Path $logDirectory ("{0}-{1}-{2}.log" -f $filePrefix, $stamp, $suffix)
$transcriptStarted = $false
$exitCode = 1

try {
    Start-Transcript -LiteralPath $logPath -Force | Out-Null
    $transcriptStarted = $true
    Push-Location $sourceDirectory
    try {
        & $pythonExecutable -c "from hermes_cli.main import main; main()" @hermesArguments
        if ($null -eq $LASTEXITCODE) {
            $exitCode = 0
        }
        else {
            $exitCode = [int]$LASTEXITCODE
        }
    }
    finally {
        Pop-Location
    }
}
catch {
    [Console]::Error.WriteLine("Logged Hermes observation failed: {0}", $_.Exception.Message)
    $exitCode = 1
}
finally {
    if ($transcriptStarted) {
        try {
            Stop-Transcript | Out-Null
        }
        catch {
            [Console]::Error.WriteLine("Unable to close transcript: {0}", $_.Exception.Message)
            if ($exitCode -eq 0) {
                $exitCode = 1
            }
        }
    }
}

[Console]::WriteLine("[portable-log] Transcript: {0}", $logPath)
exit $exitCode
