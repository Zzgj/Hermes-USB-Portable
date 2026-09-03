# Portable AI Assistant 项目迁移与开发交接指南

| 项目 | 内容 |
|---|---|
| 文档版本 | v1.2 |
| 交接日期 | 2026-09-02 |
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
- 用户已在 Stitch 创建 `Hermes Portable AI Workbench` 前端 UI；尚未导出或合并到当前 Git 仓库。

当前尚未完成：

- 尚未在 Windows 10/11 x64 实机执行完整 Runtime 下载、安装、失败恢复和重建测试。
- 尚未完成 P0-07 Hermes 更新前检查、实际版本/commit 记录、健康检查和失败回退实测。
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

Hermes Agent 暂时作为固定版本的上游依赖使用，不立即 Fork：

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
- [ ] 原版便携启动器可以运行，或已留下明确的阻塞记录。
- [x] 普通目录测试环境已建立。
- [x] 新电脑已经创建或恢复 `feat/portable-initializer`。
- [ ] 原电脑副本仍保留，直到上述检查全部通过。

## 10. 当前最重要的下一步

最小初始化器已完成。当前以 `docs/PROJECT-PLAN.md` 为实施顺序，先完成 P0-07：保留原 `Update Hermes` 能力，验证更新检查、用户数据保留、版本/commit 记录、更新后健康检查和失败回退。随后在专用 Windows 10/11 x64 测试目录验证完整 Runtime 和原启动器主流流程；仍不执行真实打印机安装。
