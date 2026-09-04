# Portable AI Assistant 项目迁移与开发交接指南

| 项目 | 内容 |
|---|---|
| 文档版本 | v2.3 |
| 交接日期 | 2026-09-04 |
| 目标环境 | 另一台 Windows 开发电脑 |
| 项目阶段 | Fork 和迁移已确认，P0 基线实现中 |
| 核心文档 | `docs/PROJECT-PLAN.md`、`docs/Portable-AI-Assistant-优化与架构备忘.md` |

## 1. 当前项目状态

项目目标是基于 `techjarves/Hermes-USB-Portable` 开发一个 **Portable AI Ops Workbench（便携式 AI 运维工作台）**。Hermes Agent 作为 Agent 内核，使用远程模型 API，不包含本地 GGUF 模型和 llama.cpp。

当前已经完成：

- 产品定位和总体架构分析。
- 远程 API、多模型/API、代理、Hermes Desktop、Obsidian、Memory、Skills 和工作台需求整理。
- 打印机安装任务及结构化进度设计。
- Portable AI 环境初始化器设计与开发测试顺序。
- U 盘本地驱动/工具制品仓库设计。
- P0–P4 实施路线、风险底线和架构决策记录。
- Stitch UI 原型提示词。
- 确认 [Zzgj/Hermes-USB-Portable](https://github.com/Zzgj/Hermes-USB-Portable) 是上游项目的 Fork，`origin` 指向个人 Fork，`upstream` 指向 `techjarves/Hermes-USB-Portable`。
- 建立并推送 `feat/portable-initializer` 分支。
- 实现普通目录最小初始化器：标准目录、版本清单、环境检查、幂等与用户数据保留。
- 建立 Windows x64 Runtime 组件锁和静态安全测试，归档 Runtime 固定版本、大小和 SHA-256，并记录可更新的 Hermes bootstrap commit。
- 建立 `docs/PROJECT-PLAN.md`，直接记录当前 P 阶段、任务 ID、状态和验收条件。
- 在 GitHub Actions 中验证初始化器，覆盖 Windows PowerShell 5.1 和 PowerShell 7。
- 修复 Windows PowerShell 5.1 通过外部 `powershell.exe -File` 调用时，参数默认值阶段 `$PSScriptRoot` 为空导致的测试入口失败；CI 改为与用户 Win10 命令一致的外部 `-File` 调用。
- 审计 Hermes 官方更新器并在 Portable 启动器增加 `--check`、`--plan` 和用户确认；更新应用、快照和回退仍复用官方实现。
- 建立顶层 `logs/` 分类目录、结构化启动器事件、Setup/Doctor/更新观察记录及 `manifests/log-sources.json` 来源目录；原始日志仍不进入 Git。
- 用户在简体中文 Win10/F 盘实测时，证明 Runtime 组件锁、启动器和日志布局测试通过；同时发现并修复 Windows PowerShell 5.1 对 UTF-8 无 BOM 脚本字面量与 JSON 的 ANSI 误解码，测试现在通过 Unicode 码点生成中文路径并断言 JSON 往返不损坏。
- 用户已在同一简体中文 Win10/Windows PowerShell 5.1 环境重试修复版：中文路径显示正确，初始化器的新建、幂等保留、冲突拒绝、无效锁拒绝和磁盘根目录拒绝全部通过；符号链接测试因普通用户缺少 Windows 创建链接权限而按设计跳过，无需提权。
- 用户第一次从健康 exFAT U 盘运行完整 `launch.bat`：Python 的 curl 下载中断后由 PowerShell 备用通道完成并通过校验，Node/uv 归档也通过校验；随后 uv 暂存目录移动被 Windows 拒绝，`ready.flag` 未生成，因此该次运行没有被误判为成功。失败后的部分 `.cache` 由用户手动删除，不需要从回收站恢复。
- 针对可移动盘暂存提交增加有限指数退避重试、记录异常类型/HRESULT、带文件数量/大小/SHA-256 校验的复制降级、旧 Runtime 备份/回滚和安装后 Python/uv/Git/Hermes 验证；新增强制移动失败的自动化测试。Linux PowerShell 7 本地回归及 GitHub Actions run 33736153394 的 Windows PowerShell 5.1/7 均通过，同一 exFAT U 盘复验待完成。
- 用户在同一 exFAT U 盘复验时，uv 暂存目录前三次移动仍被拒绝、第四次成功，Setup 随后通过 ripgrep 和 Git 安装，确认有限重试解决了原阻塞；新的阻塞是 MinGit 2.54 对不记录所有权的 exFAT 仓库触发 dubious ownership 防护。修复采用只对当前进程有效的两个精确 safe.directory 值，覆盖受管暂存仓库和安装仓库，不写宿主全局 Git 配置，也不使用信任全部仓库的通配值；GitHub Actions run 33751910110 的 Windows PowerShell 5.1/7 已通过。
- 用户最终在同一 Win10/exFAT U 盘完成首次 Runtime：Hermes 0.21.0 源码 commit 为 `29112bef099274229cadff79cdff7bf7b99c4b77`，venv、104 个核心依赖、Provider 和 Telegram 依赖安装成功，`ready.flag=True`，runtime manifest 与 commit 一致；退出后再次运行 `launch.bat` 直接进入菜单，没有重复 Setup。P0-09 据此完成。
- 可选 Playwright Chromium 在 P0-09 实机安装中失败，manifest 正确记录为 `false`，未阻止核心 Runtime 成功；当时脚本隐藏 stderr，P0-10 已补充独立诊断日志，根因需在更新后的 Win10 重试中依据该日志确认。
- P0-10 已进入实现验收：Runtime 现在为 Python、Node、uv、ripgrep、Git、Hermes 源码、venv、核心依赖及可选依赖写入原子完成回执，跳过前同时校验锁指纹与真实安装；既有成功 manifest 可无重装迁移回执，损坏回执只触发对应步骤重建。Hermes 失败暂存不再在下一次启动前删除，且修复流程不会把用户主动更新的官方 Hermes checkout 静默降级到 bootstrap commit。
- P0-07 更新观察层已实现：Windows 菜单在计划和确认后使用 portable venv 调用官方 updater，先验证 `origin` 与组件锁中的官方地址一致；官方 transcript、官方 `data/logs/update_receipts/` 回执和脱敏 Portable JSON 摘要分别保留。成功更新会把实际版本、commit、`origin/main`、时间和摘要路径写入 Runtime manifest，并刷新源码/依赖回执。Unix apply 也写入统一 transcript；真实更新和失败回退仍待 Win10/exFAT 验收。
- P0-07 本地模拟已覆盖官方成功、未审计 origin 拒绝和官方失败退出；GitHub Actions run `33783429258` 的 Windows PowerShell 5.1/7 七组测试全部通过。`docs/WINDOWS-P0-TEST-GUIDE.md` 是当前实机验收的唯一操作顺序。
- 启动器现在同时检查核心文件和 `ready.flag`，Setup 返回后再次检查 `ready.flag`，取消或异常不再进入错误的成功路径；原“删除 `.cache`”提示已替换为保留缓存并从 `logs/setup` 诊断/续跑。Playwright stdout/stderr 独立写入 `logs/setup/playwright-*.log`，仍保持可选失败不阻塞核心 Runtime。
- 用户在同一 Win10/exFAT U 盘完成 P0 七组测试；既有健康 Runtime 在不重装的情况下迁移为 `Ready=True` 且生成 10 份组件回执，重复启动没有重跑 Setup。Doctor 已完整运行并生成中央 transcript；在进行凭据 Setup 前，`.env` 与 API 未配置告警属预期。
- 首次 P0-07 实机更新已到达官方计划和用户确认，并创建 pre-update snapshot；官方更新器随后因子进程找不到 `git` 而报 `WinError 2`。Portable 层正确保存失败 transcript/JSON 且没有误报成功；故障发生在源码交换前，无需删除 Runtime 或回滚用户数据。
- `9563a9c` 已将受管 portable Git 目录前置到启动器、观察包装器和更新包装器的 PATH；GitHub Actions run `33825333550` 的 Windows PowerShell 5.1/7 均通过。修复后的 Doctor/更新检查/官方更新仍需同一 Win10/exFAT 实机复验。
- 用户已在 Stitch 创建 `Hermes Portable AI Workbench` 前端 UI；尚未导出或合并到当前 Git 仓库。

当前尚未完成：

- Windows 10/exFAT 核心 Runtime 首次安装、幂等启动和无重装组件回执迁移已通过；P0-10 尚需同一 Win10/exFAT 环境的中断续跑、损坏回执/缓存、Soft Reset 数据保留和 Playwright 日志实测。
- P0-07 失败证据链已在 Windows 实机验证；仍需用 `9563a9c` 或更新版本复验官方 `origin/main` 成功更新、三层证据、Runtime manifest 刷新和哨兵数据保留。
- Setup 与 Doctor transcript 已在 Windows 实机生成；尚需完成更新成功日志、Playwright 日志及全部日志的内容完整性、编码和脱敏边界复核。
- Stitch 中的前端 UI 尚未作为可运行代码进入仓库，也尚未连接 Hermes。
- 尚未验证 `hermes desktop` 和 `hermes serve` 的完整便携性。
- 尚未建立真实打印机驱动仓库或打印机安装 Skill。

## 2. 需要迁移的内容

### 2.1 必须迁移

至少复制以下文档：

```text
Portable-AI-Assistant-优化与架构备忘.md
Portable-AI-Assistant-项目迁移与开发交接指南.md
```

如果已经在 Stitch 创建 UI 原型，还应导出或记录：

- Stitch 项目链接或导出文件。
- 使用的最终提示词。
- 页面截图和交互说明。
- 字体、颜色、图标和组件规范。

### 2.2 如果已经创建 Git 仓库

优先通过 Git 迁移代码，不要手动复制 `.git` 目录：

```text
GitHub Fork
→ 提交并推送当前分支
→ 在新电脑重新 clone
→ 恢复本机私有配置
```

迁移前确认：

- 所有需要保留的代码已经提交。
- 当前分支已经推送到 GitHub。
- `git status` 没有遗漏的重要未跟踪文件。
- 大型驱动包没有误提交进普通 Git 历史。
- `.gitignore` 已排除密钥、缓存、Runtime、Sessions、日志和私人知识库数据。

### 2.3 不应直接上传 GitHub

以下内容应单独加密迁移或在新电脑重新配置：

```text
.env
auth.json
API Key
代理订阅和节点配置
Hermes Sessions / Memory
私人 Obsidian Vault
内部网络地址和设备资料
未获再分发许可的打印机驱动
日志与诊断报告
```

不要把真实密钥写进交接提示词、Markdown 文档或公开仓库。

## 3. 推荐的 Git 仓库关系

建议先 Fork：

```text
techjarves/Hermes-USB-Portable
```

然后在新电脑中配置：

```text
origin   → 你自己的 GitHub Fork
upstream → https://github.com/techjarves/Hermes-USB-Portable.git
```

Hermes Agent 暂时作为“稳定 Release bootstrap + 官方更新器”的上游依赖使用，不立即 Fork：

```text
https://github.com/NousResearch/hermes-agent
```

只有确认所需功能无法通过启动器、工作台、Skill、插件或 `hermes serve` 实现时，才考虑单独 Fork Hermes Agent。

推荐分支策略：

```text
main
├─ feat/portable-initializer
├─ feat/desktop-launcher
├─ feat/local-repository
├─ feat/workbench-prototype
└─ feat/printer-workflow
```

个人开发阶段无需长期维护 `develop`，使用短期 `feat/*` 分支合并到 `main` 即可。

## 4. 迁移前检查清单

- [ ] 将两份 Markdown 文档保存到安全位置。
- [ ] 确认 GitHub Fork 是否已创建。
- [ ] 如果已有本地代码，提交并推送所有应保留变更。
- [ ] 记录当前分支名和最后一个 commit ID。
- [ ] 导出 Stitch 原型或保存项目链接。
- [ ] 将私密配置放入加密归档，不上传公开仓库。
- [ ] 记录需要重新登录的账号：GitHub、模型服务商、代理服务等。
- [ ] 记录已下载驱动的来源、版本、哈希和许可证状态。
- [ ] 对迁移包计算 SHA-256，复制后重新校验。
- [ ] 保留原电脑副本，直到新电脑验证完成。

## 5. 新电脑准备

建议安装或准备：

- Git。
- GitHub CLI（可选）。
- VS Code 或其他编辑器。
- Codex 桌面端/CLI 或计划使用的开发助手。
- PowerShell 7（推荐，但脚本仍需兼容系统 Windows PowerShell 时应单独测试）。
- 用于后期构建工作台的 Node.js 工具链；在技术栈确定前不要全局安装大量依赖。
- 一个普通目录作为初期测试环境。
- 一块不含重要资料的测试 U 盘或 Windows 虚拟磁盘。

不要一开始就在真实工作 U 盘上开发。先用普通目录完成初始化器的幂等性、失败恢复和数据保留测试。

## 6. 新电脑恢复步骤

### 步骤 1：建立工作目录

使用不含同步盘干扰、路径长度适中的目录，例如：

```text
D:\Projects\Portable-AI-Assistant
```

代码不得依赖这个固定路径；这只是开发目录。

### 步骤 2：克隆自己的 Fork

```powershell
git clone <你的-Fork-URL> Portable-AI-Assistant
cd Portable-AI-Assistant
git remote add upstream https://github.com/techjarves/Hermes-USB-Portable.git
git remote -v
```

如果 Fork 尚未创建，应先在 GitHub Fork `techjarves/Hermes-USB-Portable`，再执行克隆。

### 步骤 3：恢复设计文档

将两份 Markdown 文档放入建议位置：

```text
docs/
├─ Portable-AI-Assistant-优化与架构备忘.md
└─ Portable-AI-Assistant-项目迁移与开发交接指南.md
```

如果准备提交到仓库，先检查其中没有密钥、内部地址或私人数据。

### 步骤 4：创建第一个功能分支

```powershell
git switch -c feat/portable-initializer
```

第一阶段先实现目录模式的初始化器，不连接真实 API，也不执行真实打印机安装。

### 步骤 5：恢复私密配置

从加密迁移包恢复，或在新电脑重新输入。所有私密文件保持在 `.gitignore` 范围内。首次提交前必须检查：

```powershell
git status --short
git diff --cached
```

### 步骤 6：运行基线验证

至少验证：

- Fork 可以正常启动原版 Hermes Portable。
- `origin` 和 `upstream` 指向正确仓库。
- 路径包含空格时脚本正常。
- 项目目录移动后没有写死路径。
- 测试目录中的数据不会写入开发者用户目录。
- 没有凭据被 Git 跟踪。

## 7. 接手后的开发顺序

### 第一阶段：建立可重复环境

1. 创建 `feat/portable-initializer`。
2. 定义标准目录结构和 manifest。
3. 实现初始化、检查/修复、重建 Runtime 和诊断报告。
4. 在普通临时目录反复测试，确保重复执行不破坏用户数据。
5. 固定 Hermes 和依赖版本，保存来源与 SHA-256。

### 第二阶段：补全上游入口

1. 从 `Local-Hermes-Portable/hermes/launch.bat` 移植 `hermes desktop` 菜单项。
2. 增加 CLI、TUI、Desktop 和 Dashboard 独立入口。
3. 验证 `HERMES_HOME`、AppData、Temp、Electron 缓存和更新文件的落点。

### 第三阶段：本地资源仓库

1. 建立 `repository-index.json` 和 `package.json` 规范。
2. 实现 quarantine、哈希、数字签名和 trusted 状态。
3. 只导入一个有明确来源和许可的测试驱动包。
4. 不在普通 Git 中保存大型驱动二进制。

### 第四阶段：UI 原型和工作台 MVP

1. 使用 Stitch 生成可点击原型。
2. 先跑通“初始化→API/代理→本地驱动→打印机任务→进度→记录→Draft Skill”。
3. 使用模拟任务事件验证 UI，不急于连接真实 Hermes。
4. 原型确认后再验证 `hermes serve` JSON-RPC/WebSocket。

### 第五阶段：真实打印机试点

1. 选择 Windows 10/11 x64 + TCP/IP 网络打印机这一单一场景。
2. 增加管理员审批、驱动签名校验、幂等性和回滚。
3. 在专用测试机和测试打印机上验证。
4. 成功后生成脱敏记录和 draft Skill，人工审核后才标记 trusted。

## 8. 新电脑首次会话应提供的材料

在新的开发助手会话中，至少附加或指明：

1. `Portable-AI-Assistant-优化与架构备忘.md`。
2. 本交接指南。
3. Git 仓库地址和当前分支。
4. Stitch 原型或截图（如果已经创建）。
5. 当前 `git status` 和最后一个 commit ID。
6. 本轮只需要完成的具体任务。

不要只说“继续之前的项目”。新的会话无法可靠知道未迁移的上下文，必须以文档和仓库状态为准。

## 9. 完成交接的判定标准

满足以下条件才算迁移完成：

- [x] 新电脑可以访问自己的 Fork。
- [x] 两份设计文档已恢复并可打开。
- [x] 当前分支和提交历史正确。
- [x] 私密配置没有进入 Git。
- [x] 原版便携启动器可以运行并在完整 Runtime 后重复进入菜单；Chat 等需凭据的入口尚待单独验收。
- [x] 普通目录测试环境已建立。
- [x] 新电脑已经创建或恢复 `feat/portable-initializer`。
- [ ] 原电脑副本仍保留，直到上述检查全部通过。

## 10. 当前最重要的下一步

最小初始化器、P0-09 核心 Runtime、幂等启动及 P0-10 既有 Runtime 的 10 份组件回执无重装迁移已在 Win10/exFAT 完成。当前第一优先级是在保留所有运行数据的前提下，将 U 盘副本更新到 `9563a9c` 或更新版本，复验 Doctor 中 portable Git 可见、更新检查和官方更新证据链；第二优先级才是在可丢弃副本完成 P0-10 其余恢复矩阵。在可更新基线完成前，不进入需要 API 凭据的 Setup/Chat，不执行 Full Reset 或真实打印机安装。
