[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Root,

    [Parameter(Mandatory = $true)]
    [ValidateSet("launcher", "setup", "doctor", "diagnostics")]
    [string]$Component,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9][a-z0-9._-]{0,63}$')]
    [string]$Event,

    [Parameter(Mandatory = $true)]
    [ValidateSet("started", "succeeded", "failed", "cancelled", "observed")]
    [string]$Status
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$rootPath = [System.IO.Path]::GetFullPath($Root)
if (-not (Test-Path -LiteralPath $rootPath -PathType Container)) {
    throw "Portable root does not exist: $rootPath"
}

$logDirectory = Join-Path (Join-Path $rootPath "logs") $Component
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

$payload = [ordered]@{
    schema_version = 1
    at_utc = [DateTime]::UtcNow.ToString("o")
    component = $Component
    event = $Event
    status = $Status
}
$line = ($payload | ConvertTo-Json -Compress) + [Environment]::NewLine
$path = Join-Path $logDirectory "events.jsonl"
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::AppendAllText($path, $line, $utf8WithoutBom)
