# Windows 10 / exFAT P0 测试指南

本文档是当前 `feat/portable-initializer` 测试版本的实机验收清单。请在 U 盘上的 Portable 项目副本中执行。本测试不需要管理员权限，不会格式化磁盘、安装打印机，也不会要求你公开 API Key。

## 1. 更新测试版本时保留运行数据

以下目录是运行时生成的内容，因此不会包含在 Git 或分支 ZIP 压缩包中。替换项目脚本时，必须保留 U 盘中已有的这些目录：

```text
.cache/    已校验的下载文件和安装完成的 Runtime
data/      Hermes 配置、更新回执、会话、Memory 和日志
logs/      Workbench 日志
src/       已安装或由用户更新过的 Hermes 源码仓库
.tmp/      可续传的 Hermes 暂存仓库（如果存在）
knowledge/ 私人 Obsidian 知识库
```

不要从回收站还原旧的、不完整的 `.cache`，也不要删除当前正在使用的 `.cache`。请只把新版本中受 Git 跟踪的文件和目录（`launch.*`、`scripts/`、`tests/`、`manifests/`、`docs/`）覆盖到测试副本，同时保留上述运行数据目录。

## 2. 运行不需要额外依赖的回归测试

在 Windows PowerShell 5.1 中进入 Portable 项目根目录，然后运行：

```powershell
$tests = @(
    ".\tests\portable-initializer.Tests.ps1",
    ".\tests\runtime-component-lock.Tests.ps1",
    ".\tests\runtime-filesystem.Tests.ps1",
    ".\tests\runtime-setup-state.Tests.ps1",
    ".\tests\portable-update-state.Tests.ps1",
    ".\tests\portable-launcher.Tests.ps1",
    ".\tests\reset-windows.Tests.ps1",
    ".\tests\log-layout.Tests.ps1"
)

foreach ($test in $tests) {
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File $test
    if ($LASTEXITCODE -ne 0) { throw "测试失败：$test（退出码 $LASTEXITCODE）" }
}
```

预期结果：每个脚本最后都显示 `tests passed`。如果当前 Windows 账号没有创建符号链接的权限，初始化器测试可能提示跳过符号链接用例；这不属于测试失败，也不需要提升权限。

## 3. 在不重装 Runtime 的情况下迁移组件回执

P0-10 之前创建的 Runtime 还没有组件级回执。请在 `ready.flag` 仍然存在时，直接运行一次 Setup 脚本：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1 -Root (Get-Location).Path

$state = ".\.cache\runtimes\windows-x64\state"
[pscustomobject]@{
    Ready = Test-Path ".\.cache\runtimes\windows-x64\ready.flag"
    ReceiptCount = @(Get-ChildItem $state -Filter "*.json" -File).Count
}
```

预期结果：Setup 显示 `Runtime is already complete; no setup work is required`。脚本会执行实时健康检查并创建组件回执，但不会重新下载或安装 Python、Node 或 Hermes。

新版 Setup 还会把旧的 `src\hermes-agent\.portable-source.json` 原子迁移到 `.cache\runtimes\windows-x64\hermes-source.json`，并仅对 [Hermes 上游已确认的两个大小写冲突路径](https://github.com/NousResearch/hermes-agent/issues/89048) 设置本地 `skip-worktree`。这不改动文件内容、不写入全局 Git 配置，上游移除任一冲突路径后会撤销剩余路径的标记。运行后执行：

```powershell
$git = ".\.cache\runtimes\windows-x64\git\cmd\git.exe"
$repo = ".\src\hermes-agent"
& $git -c core.quotepath=false -C $repo status --porcelain=v1 --untracked-files=all
if ($LASTEXITCODE -ne 0) { throw "Hermes 源码状态检查失败。" }

[pscustomobject]@{
    CanonicalSourceState = Test-Path ".\.cache\runtimes\windows-x64\hermes-source.json"
    LegacySourceState = Test-Path ".\src\hermes-agent\.portable-source.json"
}
```

预期 Git 状态没有任何输出，`CanonicalSourceState=True`，`LegacySourceState=False`。如仍有其他路径，保留现场并停止更新/恢复测试，不要执行 `reset --hard`、`clean -fd` 或删除用户文件。

随后运行一次 `.\launch.bat`，进入菜单后正常退出。Windows PowerShell 默认不会从当前目录查找命令，因此必须保留开头的 `.\`。启动过程中不应再次显示 Runtime Setup/Repair。

## 4. 验证只读 Doctor 和更新检查

运行 `.\launch.bat`，进入 `Advanced Options`（高级选项），依次执行：

1. `Run Doctor`（运行 Doctor）。
2. `Check for Updates`（检查更新）。
3. `Update Hermes`（更新 Hermes），第一次到应用确认界面时选择 `N`。

这些操作应在 `logs/doctor/` 和 `logs/diagnostics/` 下生成带时间戳的文件。Doctor、更新检查和更新计划不会应用更新；在确认界面选择 `N` 也不得改变当前 Hermes commit。

Doctor 的 `git` 检查必须通过。如果 Doctor 显示 `git not found`，或者更新检查/更新应用报 `FileNotFoundError: [WinError 2]`，说明测试副本早于修复提交 `9563a9c`。此时不要删除 Runtime 或用户数据；请从当前分支更新 `launch.bat`、`scripts/invoke-hermes-observation.ps1`、`scripts/invoke-hermes-update.ps1` 以及对应测试文件，然后从本节重试。

如果只读更新检查报 HTTP 429、`curl 56`、TLS 提前断开或类似 GitHub 网络错误，但明确显示 `No update was applied`，则属于安全的只读失败。保留 `logs/diagnostics/update-check-*.log`，不要为了绕过限流而在公共测试输出中添加或粘贴 GitHub Token；等待 Git 通道恢复后再续验。

## 5. 验收 Hermes 官方更新流程

应用更新前，先创建两个不含敏感内容的测试哨兵文件。下面的命令不会打开或覆盖已有用户文件：

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

打开 `.\launch.bat` → `Advanced Options` → `Update Hermes`。先检查官方更新计划，确认准备完成后再选择 `Y`，并按官方更新器的后续提示操作。测试期间不要在其他窗口启动 Chat 或 Gateway。

菜单报告更新完成后，运行以下命令。它只显示允许检查的摘要字段，不会输出 API Key、配置内容或会话正文：

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

通过验收必须同时满足：

- `PortableStatus = succeeded`、`OfficialExitCode = 0`、`OriginVerified = True`，并且 `Channel = origin/main`。
- 官方更新结果为 `success`，或者是官方明确说明的“已经是最新版本”等成功状态。
- Runtime manifest 中的 commit 和版本与 `PostCommit`、`PostVersion` 完全一致。
- `SentinelsPreserved = True`，证明测试会话目录和知识库中的哨兵文件没有丢失。
- `logs/diagnostics/` 中存在时间戳对应的更新 transcript 和 JSON 摘要，`data/logs/update_receipts/` 中存在官方更新回执。
- 第二次运行 `.\launch.bat` 时直接进入菜单，不重新安装 Runtime，也不把 Hermes 降级回 bootstrap 版本。

如果更新失败，不要删除 `.cache`、`src` 或 `data`。退出启动器并运行以下命令列出需要保留的最新文件。不要把文件路径本身当作 PowerShell 命令直接运行：

```powershell
Get-ChildItem ".\logs\diagnostics\update-apply-*.log" -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1 FullName, Length, LastWriteTime

Get-ChildItem ".\logs\diagnostics\update-apply-*.json" -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1 FullName, Length, LastWriteTime

Get-Item ".\data\logs\update_receipts\latest.json" -ErrorAction SilentlyContinue |
    Select-Object FullName, Length, LastWriteTime
```

原始 `.log` 和官方回执可能包含本机路径或 Profile 信息，发送前必须先检查。Portable JSON 摘要已经刻意缩小字段范围，但发送前仍建议复核。

## 6. P0-10 破坏性边界测试

损坏回执、主动取消和 Soft Reset 测试会有意修改 Runtime 测试状态，因此不属于第一次更新验收。保存完更新证据后，只能在可丢弃的完整副本中执行 P0-10 恢复测试。

当官方更新因外部网络暂时无法续验时，可先在同一 NTFS 盘创建一份脱敏 Runtime 沙箱。沙箱只复制启动文件、脚本/测试/清单/文档、`.cache/runtimes/` 和 `src/`；不复制 `data/`、`knowledge/`、`logs/` 或宿主应用缓存。先确认目标目录不存在且空间足够，再开始复制。

脱敏沙箱完成首次无修复启动后，应在沙箱内创建非敏感的 `data/` 和 `knowledge/` 哨兵，再按顺序测试：损坏 ripgrep 组件回执后只重建该步骤、Playwright 失败单独写日志、Soft Reset 保留哨兵。每次只执行一个故障用例，并在进入下一项前确认 Runtime 恢复健康。

如果沙箱是从旧版 Runtime 复制的，先把当前分支的 `scripts/`、`tests/`、`manifests/` 和启动文件覆盖到沙箱，然后在沙箱根目录执行第 3 节的 Setup 命令和 Git 清洁度检查。只有 Git 状态为 clean 才进入故障注入。

当前 E 盘脱敏沙箱 `E:\HermesPortable-P0-10-Sandbox-20260904-231542` 已在 2026-09-05 完成上述门禁：源实例和沙箱均为 clean，Runtime 权威源码状态已迁移，旧工作树状态已移除，两个已知大小写冲突路径已隐藏；两次 Setup 均确认 Runtime 已完整且无需安装。下一项从损坏 ripgrep 回执的单步重建开始。

损坏 ripgrep 回执的单步重建已通过：只有 ripgrep 步骤重建，其余回执未变化，`ready.flag`、可执行文件哈希、Git clean 状态以及 `data/`/`knowledge/` 哨兵全部保持正确；Playwright 缺包也生成了独立非空日志且未阻塞核心 Setup。证据摘要为沙箱内 `logs/diagnostics/p0-ripgrep-recovery-20260905-123146/result.json`。下一项只损坏约 1.73 MB 的 `rg.zip`，验证缓存校验拒绝和重新下载。

损坏 `rg.zip` 的恢复也已通过：Setup 拒绝伪造缓存，从组件锁 URL 重新下载并验证归档，恢复 ripgrep、回执和 `ready.flag`，其他回执、哨兵与 Git clean 状态均未变化。证据摘要为 `logs/diagnostics/p0-rg-cache-recovery-20260905-124011/result.json`。下一项使用临时不可达 URL 制造可重复的下载中断，先验证失败关闭，再恢复原锁和原始已校验缓存续跑。

受控中断续跑已经通过：第一次运行对不可达 URL 非零退出且未生成 `ready.flag`，既有回执未改变；恢复原锁和已校验缓存后，第二次运行成功恢复全部健康状态。证据补充为 `logs/diagnostics/p0-interruption-retry-20260905-124604/result-addendum.json`。进入 Soft Reset 前必须先使用包含确认后变更、当前 Portable 根目录 Gateway 限定及相应行为测试的新版 `reset-windows.ps1`；旧版不得用于该验收。

不要在日常使用的 U 盘副本上运行 `reset-windows.ps1 -Mode full`，P0 阶段也不要测试真实打印机安装。
