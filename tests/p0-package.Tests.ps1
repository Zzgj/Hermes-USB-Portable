$ErrorActionPreference = 'Stop'
function Assert($Value, $Message) { if (-not $Value) { throw $Message } }
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('p0-package-tests-' + [Guid]::NewGuid().ToString('N'))
$hostExe = (Get-Process -Id $PID).Path
try {
    $package = Join-Path $fixture 'package'
    $target = Join-Path $fixture 'target with space'
    New-Item -ItemType Directory -Path "$package/scripts", "$target/data" -Force | Out-Null
    Copy-Item "$PSScriptRoot/../scripts/install-p0-package.ps1" "$package/scripts/install-p0-package.ps1"
    [IO.File]::WriteAllText("$package/launch.bat", 'new shell')
    [IO.File]::WriteAllText("$target/launch.bat", 'old shell')
    [IO.File]::WriteAllText("$target/data/.env", 'SECRET_SENTINEL')
    $manifest = @{ schema_version=1; candidate='p0-rc1'; files=@(@{path='launch.bat';sha256=(Get-FileHash "$package/launch.bat").Hash}) }
    $manifest | ConvertTo-Json -Depth 5 | Set-Content "$package/package-manifest.json" -Encoding UTF8
    & $hostExe -NoProfile -File "$package/scripts/install-p0-package.ps1" -Target $target -ConfirmInstall
    Assert ($LASTEXITCODE -eq 0) 'Installer should succeed'
    Assert ([IO.File]::ReadAllText("$target/launch.bat") -eq 'new shell') 'Shell replaced'
    Assert ([IO.File]::ReadAllText("$target/data/.env") -eq 'SECRET_SENTINEL') 'User data preserved'
    $saved = @(Get-ChildItem "$target/logs/diagnostics" -Directory)[0].FullName
    Assert ([IO.File]::ReadAllText("$saved/launch.bat") -eq 'old shell') 'Original shell backed up'
    [IO.File]::WriteAllText("$package/launch.bat", 'tampered')
    $ErrorActionPreference = 'Continue'
    & $hostExe -NoProfile -File "$package/scripts/install-p0-package.ps1" -Target $target -ConfirmInstall *> $null
    $ErrorActionPreference = 'Stop'
    Assert ($LASTEXITCODE -ne 0) 'Tampered package rejected'
    Assert ([IO.File]::ReadAllText("$target/launch.bat") -eq 'new shell') 'Tamper failure does not mutate target'
    $manifest.files[0].path = '../outside'
    $manifest | ConvertTo-Json -Depth 5 | Set-Content "$package/package-manifest.json" -Encoding UTF8
    $ErrorActionPreference = 'Continue'
    & $hostExe -NoProfile -File "$package/scripts/install-p0-package.ps1" -Target $target -ConfirmInstall *> $null
    $ErrorActionPreference = 'Stop'
    Assert ($LASTEXITCODE -ne 0) 'Traversal rejected'
    & $hostExe -NoProfile -File "$PSScriptRoot/../scripts/portable-diagnostics.ps1" -Root $target *> $null
    Assert ($LASTEXITCODE -eq 1) 'Uninstalled runtime must not be reported healthy'
    $report = @(Get-ChildItem "$target/logs/diagnostics/p0-report-*.json")[0]
    $text = Get-Content $report.FullName -Raw
    Assert (-not $text.Contains('SECRET_SENTINEL')) 'Report excludes secrets'
    Assert (-not $text.Contains($target)) 'Report excludes absolute root'
    Write-Host 'P0 package and diagnostics tests passed.'
} finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force -ErrorAction SilentlyContinue
}
