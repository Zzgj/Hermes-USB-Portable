# Windows 10 / exFAT P0 test guide

This guide is the acceptance checklist for the current `feat/portable-initializer` build. Run it in a copy of the Portable folder on the USB drive. It does not require administrator privileges, format a disk, install a printer, or ask you to expose an API key.

## 1. Preserve generated state when updating the test build

The generated folders below are intentionally absent from Git/branch ZIP files. When replacing project scripts, keep the existing copies on the USB drive:

```text
.cache/    verified downloads and installed Runtime
data/      Hermes configuration, receipts, sessions, memory and logs
logs/      Workbench logs
src/       installed and user-updated Hermes checkout
.tmp/      resumable Hermes staging, if present
knowledge/ private Obsidian vault
```

Do not restore an old incomplete `.cache` from the Recycle Bin, and do not delete the current working `.cache`. Copy the new tracked files (`launch.*`, `scripts/`, `tests/`, `manifests/`, `docs/`) over the test build while leaving the generated folders in place.

## 2. Run the dependency-free regression tests

From the Portable root in Windows PowerShell 5.1:

```powershell
$tests = @(
    ".\tests\portable-initializer.Tests.ps1",
    ".\tests\runtime-component-lock.Tests.ps1",
    ".\tests\runtime-filesystem.Tests.ps1",
    ".\tests\runtime-setup-state.Tests.ps1",
    ".\tests\portable-update-state.Tests.ps1",
    ".\tests\portable-launcher.Tests.ps1",
    ".\tests\log-layout.Tests.ps1"
)

foreach ($test in $tests) {
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File $test
    if ($LASTEXITCODE -ne 0) { throw "测试失败：$test (exit $LASTEXITCODE)" }
}
```

Expected result: every script ends in `tests passed`. The symbolic-link initializer case may say it was skipped when the Windows account lacks link-creation permission; that is not a failure and does not require elevation.

## 3. Adopt component receipts without reinstalling Runtime

Existing Runtime installations created before P0-10 do not yet have component receipts. Run setup directly once while `ready.flag` is still present:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1 -Root (Get-Location).Path

$state = ".\.cache\runtimes\windows-x64\state"
[pscustomobject]@{
    Ready = Test-Path ".\.cache\runtimes\windows-x64\ready.flag"
    ReceiptCount = @(Get-ChildItem $state -Filter "*.json" -File).Count
}
```

Expected result: setup says `Runtime is already complete; no setup work is required`, performs live checks, creates receipts, and does not download or reinstall Python/Node/Hermes.

Then run `launch.bat`, enter and exit the menu once. It should not display Runtime Setup/Repair.

## 4. Read-only Doctor and update checks

In `launch.bat`, open `Advanced Options` and run:

1. `Run Doctor`.
2. `Check for Updates`.
3. `Update Hermes`, then answer `N` at the apply confirmation for the first pass.

These actions should create timestamped files under `logs/doctor/` and `logs/diagnostics/`. The first two updater actions are read-only; answering `N` must not change the Hermes commit.

## 5. Official Hermes update acceptance

Before applying the update, create dedicated non-secret sentinels. Existing user files are not opened or overwritten:

```powershell
$sentinelValue = [guid]::NewGuid().ToString("N")
$sentinels = @(
    ".\data\sessions\p0-update-sentinel.txt",
    ".\knowledge\ObsidianVault\00-Inbox\p0-update-sentinel.txt"
)
foreach ($path in $sentinels) {
    if (Test-Path -LiteralPath $path) { throw "测试哨兵已存在，请先改用其他文件名：$path" }
    New-Item -ItemType Directory -Path (Split-Path -Parent $path) -Force | Out-Null
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $sentinelValue)
}
```

Open `launch.bat` → `Advanced Options` → `Update Hermes`. Review the official plan, answer `Y` only when ready, and follow any additional prompts from the official updater. Do not start Chat or Gateway in another window during this test.

After the menu reports completion, inspect only the allowlisted summary fields:

```powershell
$runtimeManifest = Get-Content ".\.cache\runtimes\windows-x64\runtime-manifest.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$portableReceiptFile = Get-ChildItem ".\logs\diagnostics\update-apply-*.json" -File |
    Sort-Object LastWriteTimeUtc |
    Select-Object -Last 1
$portableReceipt = $portableReceiptFile | Get-Content -Raw -Encoding UTF8 | ConvertFrom-Json
$officialReceipt = Get-Content ".\data\logs\update_receipts\latest.json" -Raw -Encoding UTF8 | ConvertFrom-Json

[pscustomobject]@{
    PortableStatus = $portableReceipt.status
    OfficialExitCode = $portableReceipt.official_exit_code
    Channel = $portableReceipt.channel
    OriginVerified = $portableReceipt.official_origin_verified
    PreCommit = $portableReceipt.source.pre_update.commit
    PostCommit = $portableReceipt.source.post_update.commit
    PreVersion = $portableReceipt.source.pre_update.version
    PostVersion = $portableReceipt.source.post_update.version
    OfficialOutcome = $officialReceipt.outcome
    ManifestCommit = $runtimeManifest.hermes_commit
    ManifestVersion = $runtimeManifest.hermes_version
    ManifestReceipt = $runtimeManifest.hermes_update_receipt
    SentinelsPreserved = (@($sentinels | Where-Object {
        (Get-Content -LiteralPath $_ -Raw) -eq $sentinelValue
    }).Count -eq $sentinels.Count)
}
```

Acceptance requires:

- `PortableStatus = succeeded`, `OfficialExitCode = 0`, `OriginVerified = True` and `Channel = origin/main`.
- The official outcome is `success` (or another clearly explained official no-op success state).
- Runtime manifest commit/version equal the post-update commit/version.
- `SentinelsPreserved = True`.
- A transcript and JSON summary with the same timestamp exist in `logs/diagnostics/`, and the official receipt exists in `data/logs/update_receipts/`.
- A second `launch.bat` starts directly without reinstalling or downgrading Hermes.

If the update fails, do not delete `.cache`, `src`, or `data`. Exit the launcher and retain the newest matching `logs/diagnostics/update-apply-*.log`, `logs/diagnostics/update-apply-*.json`, and `data/logs/update_receipts/latest.json`. Raw `.log` and official receipt files may contain local paths/profile details; review them before sharing. The Portable JSON summary is intentionally narrower but should still be reviewed.

## 6. P0-10 destructive-boundary tests

Corrupt-receipt, cancellation, and Soft Reset checks deliberately change Runtime test state. They are not part of the first update pass. Follow the P0-10 checklist only in a disposable copy after the update evidence has been saved. Never run `reset-windows.ps1 -Mode full` against the working USB copy, and never test a real printer during P0.
