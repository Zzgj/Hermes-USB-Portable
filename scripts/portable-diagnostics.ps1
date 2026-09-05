[CmdletBinding()]
param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$Root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Root)
$runtime = Join-Path $Root '.cache/runtimes/windows-x64'
$source = Join-Path $Root 'src/hermes-agent'
function Probe([string]$Executable, [string]$Arguments) {
    if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) { return $false }
    $process = New-Object Diagnostics.Process
    $process.StartInfo = New-Object Diagnostics.ProcessStartInfo
    $process.StartInfo.FileName = $Executable
    $process.StartInfo.Arguments = $Arguments
    $process.StartInfo.WorkingDirectory = $Root
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    $process.StartInfo.EnvironmentVariables['PYTHONPATH'] = ''
    $process.StartInfo.EnvironmentVariables['PYTHONHOME'] = ''
    $process.StartInfo.EnvironmentVariables['PYTHONNOUSERSITE'] = '1'
    $process.StartInfo.EnvironmentVariables['HERMES_HOME'] = (Join-Path $Root 'data')
    try {
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(20000)) { $process.Kill(); return $false }
        return ($process.ExitCode -eq 0)
    } catch { return $false } finally { $process.Dispose() }
}
$checks = [ordered]@{}
$checks.RootMarker = Test-Path -LiteralPath (Join-Path $Root 'launch.bat')
$lock = Join-Path $Root 'manifests/runtime-components.windows-x64.json'
$ready = Join-Path $runtime 'ready.flag'
$manifestPath = Join-Path $runtime 'runtime-manifest.json'
$checks.LockAndReady = $false
$checks.ManifestMatchesLock = $false
$version = $null
$commit = $null
try {
    $hash = (Get-FileHash -LiteralPath $lock).Hash
    $checks.LockAndReady = (Get-Content -LiteralPath $ready -Raw).Trim() -eq $hash
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $checks.ManifestMatchesLock = $manifest.component_lock_sha256 -eq $hash
    if ([string]$manifest.hermes_commit -match '^[0-9a-f]{40}$') { $commit = $manifest.hermes_commit }
    if ([string]$manifest.hermes_version -match '^\d+\.\d+\.\d+[-+.a-zA-Z0-9]*$') { $version = $manifest.hermes_version }
} catch {}
$checks.LocationMatches = $false
$marker = Join-Path $runtime 'portable-location.txt'
if (Test-Path -LiteralPath $marker) { $checks.LocationMatches = (Get-Content -LiteralPath $marker -Raw).Trim() -eq $Root.TrimEnd('\', '/') }
foreach ($entry in @(
    @('Python', 'python/python.exe'), @('Node', 'node/node.exe'),
    @('Uv', 'uv/uv.exe'), @('Ripgrep', 'bin/rg.exe'), @('Git', 'git/cmd/git.exe')
)) { $checks[$entry[0]] = Probe (Join-Path $runtime $entry[1]) '--version' }
$checks.GitBash = Probe (Join-Path $runtime 'git/bin/bash.exe') '--noprofile --norc -c "printf GIT_BASH_OK"'
$checks.HermesImport = Probe (Join-Path $runtime 'venv/Scripts/python.exe') '-c "import hermes_cli.main"'
# Report booleans and counts, never raw config, proxy URLs, process command lines,
# usernames, root paths, session contents, or native stdout/stderr.
$hostFindings = [ordered]@{
    UserPathMentionsCua = ([string][Environment]::GetEnvironmentVariable('PATH', 'User') -match '(?i)cua-driver')
    CuaPackageOutsidePortableRoot = Test-Path -LiteralPath (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.cua-driver')
    ReparsePointsPresent = $false
    ReparseScanComplete = $true
    ScheduledTaskQuerySucceeded = $false
    HermesGatewayTaskPresent = $false
    CuaAutostartTaskPresent = $false
}
$queue = New-Object 'System.Collections.Generic.Queue[string]'
$queue.Enqueue($Root)
try {
    while ($queue.Count -gt 0) {
        $dir = $queue.Dequeue()
        if ((Get-Item -LiteralPath $dir -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { $hostFindings.ReparsePointsPresent = $true; continue }
        foreach ($item in @(Get-ChildItem -LiteralPath $dir -Force)) {
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { $hostFindings.ReparsePointsPresent = $true }
            elseif ($item.PSIsContainer -and $item.Name -ne '.git' -and $item.Name -ne 'node_modules') { $queue.Enqueue($item.FullName) }
        }
    }
} catch { $hostFindings.ReparseScanComplete = $false }
try {
    $tasks = @(Get-ScheduledTask -ErrorAction Stop)
    $hostFindings.HermesGatewayTaskPresent = @($tasks | Where-Object TaskName -eq 'Hermes_Gateway').Count -gt 0
    $hostFindings.CuaAutostartTaskPresent = @($tasks | Where-Object TaskName -eq 'cua-driver-serve').Count -gt 0
    $hostFindings.ScheduledTaskQuerySucceeded = $true
} catch {}
$capabilities = [ordered]@{
    CLI = Test-Path -LiteralPath (Join-Path $source 'hermes_cli/main.py')
    TUIAssets = Test-Path -LiteralPath (Join-Path $source 'ui-tui/node_modules')
    WebAssets = Test-Path -LiteralPath (Join-Path $source 'hermes_cli/web_dist/index.html')
    DesktopWorkspace = Test-Path -LiteralPath (Join-Path $source 'desktop/package.json')
}
$passed = @($checks.Values | Where-Object { -not $_ }).Count -eq 0
$report = [ordered]@{ schema_version = 1; candidate = 'p0-rc1'; utc = [DateTime]::UtcNow.ToString('o'); core_passed = $passed; hermes_version = $version; hermes_commit = $commit; checks = $checks; capabilities = $capabilities; host_findings = $hostFindings }
$outputDir = Join-Path $Root 'logs/diagnostics'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$output = Join-Path $outputDir ('p0-report-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8) + '.json')
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $output -Encoding UTF8
[pscustomobject]$checks | Format-List
[pscustomobject]$hostFindings | Format-List
Write-Host "P0 report: $output"
if (-not $passed) { exit 1 }
