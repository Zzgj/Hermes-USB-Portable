# Portable AI Assistant 优化与架构备忘

> 面向 `Hermes-USB-Portable` 的长期需求、架构决策与实施路线记录。

| 项目 | 内容 |
|---|---|
| 文档状态 | 活文档（持续维护） |
| 当前版本 | v0.8 |
| 建立日期 | 2026-09-02 |
| 最近更新 | 2026-09-04 |
| 当前阶段 | P0 基线实现中 |
| 进度清单 | [`docs/PROJECT-PLAN.md`](PROJECT-PLAN.md) |
| 基础项目 | [techjarves/Hermes-USB-Portable](https://github.com/techjarves/Hermes-USB-Portable) |
| 参考项目 | [techjarves/Local-Hermes-Portable](https://github.com/techjarves/Local-Hermes-Portable)、[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)、[yuluyangguang1/codex-portable](https://github.com/yuluyangguang1/codex-portable) |

## 1. 产品定位

本项目不是简单的“U 盘版 Hermes CLI”，而是一个 **Portable AI Ops Workbench（便携式 AI 运维工作台）**。

目标体验：

1. 将 U 盘或移动 SSD 插入 Windows 电脑。
2. 双击统一入口，打开图形化工作台。
3. 使用远程大模型 API，由 Hermes 负责推理、工具调用、记忆和 Skills。
4. 从工作台执行打印机安装、网络诊断、Windows 修复等日常运维任务。
5. 普通用户看到清晰的步骤、状态和结果；高级用户可展开命令、日志，也可随时进入 CLI、TUI、Desktop 或 WebUI。
6. 成功的操作可以沉淀为知识记录或参数化 Skill，供下次复用。

明确不纳入当前主线：

- 本地 GGUF 模型、llama.cpp、llmfit。
- 把 CLI 文本输出解析成 GUI 的核心集成方式。
- 无审批地自动执行所有管理员操作。

## 2. 当前结论摘要

| 主题 | 当前决策 | 状态 |
|---|---|---|
| 模型 | 优先远程 API，不集成本地模型推理 | 已决定 |
| Agent 内核 | 继续使用 Hermes Agent，不重复实现 Agent | 已决定 |
| 默认界面 | 长期目标为自有工作台；短期接入 Hermes Desktop | 已决定 |
| CLI / TUI / WebUI | 全部作为可选入口保留 | 已决定 |
| Desktop 快速改进 | 从 `Local-Hermes-Portable/hermes/launch.bat` 移植 `hermes desktop` 菜单项 | 已确认 |
| 工作台与 Hermes 通信 | 优先使用 `hermes serve` 的 JSON-RPC/WebSocket，而非解析 stdout | 已决定，待原型验证 |
| API 管理 | 复用 Hermes provider/config/profile，增加类似 CC Switch 的可视化管理层 | 已决定 |
| 代理 | 先支持系统代理和自定义代理；便携 Mihomo 为可选组件；不默认捆绑完整 Clash Verge | 建议方案 |
| 知识库 | 使用便携 Obsidian Vault（Markdown 文件夹） | 已决定 |
| 经验沉淀 | Memory 存事实，Obsidian 存长期记录，Skill 存可重复流程 | 已决定 |
| 环境初始化 | 提供可重复的目录/U 盘初始化器，但不自动格式化整块磁盘 | In Progress：普通目录最小版已实现并通过 CI |
| Hermes 更新 | bootstrap 版本只用于首次安装；保留用户主动更新到新版本的能力，并记录实际版本/commit | In Progress：P0-07 |
| 本地资源仓库 | 在 U 盘建立带清单、哈希和适用条件的驱动/工具包仓库 | 已决定 |
| 安全 | API Key、代理订阅、知识库和会话不得长期裸奔在易丢失 U 盘上 | 必须设计 |

## 3. 已确认的上游能力与差距

### 3.1 Hermes-USB-Portable 当前状态

当前 Windows 启动器已经完成：

- 将 `HERMES_HOME` 指向便携目录中的 `data/`。
- 随包管理 Python、Node、uv、虚拟环境和 Playwright 浏览器路径。
- 提供 Chat、Setup、Gateway、Doctor、日志、配置编辑和更新入口。

但当前主菜单没有 Desktop 和 Web Dashboard。其 [Windows 启动脚本](https://github.com/techjarves/Hermes-USB-Portable/blob/main/launch.bat) 仍以终端菜单和 Hermes CLI 为主。

### 3.2 可直接借鉴的 Desktop 入口

`Local-Hermes-Portable` 内嵌的 Hermes 启动器已提供：

```text
[2] Start Hermes Desktop GUI
```

其实现等价于：

```text
hermes desktop
```

代码可在 [内嵌 launch.bat](https://github.com/techjarves/Local-Hermes-Portable/blob/main/hermes/launch.bat) 中核对。这是第一阶段应优先移植的低成本功能。

注意：菜单能够调用 Desktop，不等于 Desktop 已满足“全量数据零落地宿主机”。仍需验证 Electron、更新器、缓存、日志、临时目录和 WebView/浏览器组件是否全部服从便携路径。

### 3.3 Desktop / WebUI 的正确定位

Hermes 官方目前提供多个共享状态的前端：

- `hermes`：经典 CLI。
- `hermes --tui`：现代终端界面。
- `hermes dashboard`：浏览器 Web Dashboard。
- `hermes desktop`：桌面 GUI。
- `hermes serve`：无界面后端，为 Desktop 和远程客户端提供 JSON-RPC/WebSocket。

官方 Desktop 是 Electron/React 前端，并启动 `hermes serve` 后端；它不是简单嵌入 TUI。详见 [Hermes Desktop 文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/desktop.md) 和 [CLI 命令参考](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/cli-commands.md)。

因此，自有工作台应直接消费结构化事件和后端接口，不应依赖 CLI 的文字、ANSI 颜色或终端布局。

## 4. 目标架构

```text
Portable AI Workbench
│
├─ 首页 / AI 对话 / 运维工具 / 知识库 / Skills / 设置
├─ 任务编排与进度展示
├─ 权限、审批、取消、恢复、日志与审计
│
├──────── JSON-RPC / WebSocket ────────┐
│                                      │
│                               hermes serve
│                                      │
│                 ┌────────────────────┼───────────────────┐
│                 │                    │                   │
│              Agent / Tools        Memory              Skills
│                 │                                        │
│                 └──────── Windows / Browser / Files ─────┘
│
├─ 模型与凭据管理 ── Hermes config / .env / auth / profiles
├─ 网络管理 ─────── 系统代理 / 自定义代理 / 可选 Mihomo
└─ 知识管理 ─────── Obsidian Vault（Markdown）
```

建议目录：

```text
Portable-AI/
├─ Workbench.exe
├─ launcher/
├─ runtime/
│  ├─ hermes/
│  ├─ python/
│  ├─ node/
│  └─ git/
├─ data/
│  ├─ profiles/
│  ├─ sessions/
│  ├─ memories/
│  ├─ auth/
│  └─ settings/
├─ knowledge/
│  └─ ObsidianVault/
├─ skills/
│  ├─ printer/
│  ├─ windows/
│  ├─ network/
│  └─ office/
├─ repository/
│  ├─ drivers/
│  ├─ tools/
│  ├─ packages/
│  ├─ manifests/
│  └─ repository-index.json
├─ proxy/
│  ├─ mihomo/          # 可选组件
│  └─ profiles/
├─ workspace/
├─ logs/
└─ updates/
```

所有路径必须由启动时的便携根目录动态计算，不能写死盘符。

## 5. 功能需求清单

### R-001 远程 API 优先

需求：支持 OpenAI、OpenRouter、Anthropic 以及 OpenAI-compatible API，不下载或运行本地大模型。

验收标准：

- 可设置 provider、model、base URL 和凭据。
- 可进行连通性测试，并区分 DNS、代理、TLS、鉴权、配额和模型不存在等错误。
- 任务开始时记录实际使用的 provider/model，但日志不得泄露完整密钥。

### R-002 多模型 / 多 API 管理

需求：提供类似 CC Switch 的图形化体验，但不把 CC Switch 直接作为 Hermes 的配置真源。

设计：

- Hermes 原生配置和凭据机制是单一事实来源。
- 工作台提供“连接”与“任务配置”两层：
  - 连接：名称、provider、base URL、凭据引用、代理策略。
  - 任务配置：默认模型、备用模型、推理强度、用途标签、关联 Profile。
- 优先映射到 Hermes Profiles；官方 Profiles 可隔离 `config.yaml`、`.env`、Memory、Sessions、Skills 和 Gateway 状态，详见 [Profiles 文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/profiles.md)。
- 借鉴 [codex-portable 的 CC Switch 集成](https://github.com/yuluyangguang1/codex-portable/blob/main/README.md) 的交互思路，但避免符号链接、进程强杀和配置文件互相覆盖成为核心依赖。

建议的首批配置：日常运维、复杂诊断、低成本任务、编程辅助。

### R-003 代理与网络环境

需求：在受限网络中让模型 API、GitHub、依赖下载和浏览器访问可用。

分层方案：

1. 直连。
2. 继承 Windows 系统代理。
3. 自定义 HTTP/HTTPS/SOCKS 代理。
4. 启动便携 Mihomo Core（可选组件）。
5. 外部 Clash Verge（高级用户自行选择，不作为强依赖）。

启动器向 Hermes 及子进程注入 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 和 `NO_PROXY`，同时处理大小写变体。Hermes 代码已识别这些变量，但仍要分别验证模型请求、Gateway、Git、下载器、Node、Python 和浏览器流量。

不建议默认捆绑完整 Clash Verge，原因包括体积、WebView2、系统代理/TUN、服务安装、管理员权限、许可证与更新责任。便携 Mihomo 也必须采用“用户提供配置/订阅”的方式，不预置任何节点或第三方服务。

验收标准：可一键测试模型 API、GitHub 和常用下载源；能显示当前出口模式；停止工作台后按用户设置决定恢复系统代理。

### R-004 Hermes Desktop GUI

第一阶段：将 `Start Hermes Desktop GUI` 移植到主仓库启动器。

第二阶段：验证并固定：

- `HERMES_HOME` 是否始终指向便携数据目录。
- `HERMES_DESKTOP_HERMES_ROOT` 等 Desktop 后端解析路径。
- `%APPDATA%`、`%LOCALAPPDATA%`、临时目录、Electron 缓存和更新文件的实际落点。
- U 盘盘符改变、目录含空格和非 ASCII 字符时能否正常启动。
- Desktop 与 CLI 是否安全共享状态，是否存在并发写同一 Profile 的风险。

### R-005 Obsidian 知识库 / 长期记录

Hermes 自带 Obsidian Skill，可读取、搜索、创建和编辑 Vault 中的 Markdown，并约定使用 `OBSIDIAN_VAULT_PATH`。详见 [Obsidian Skill](https://github.com/NousResearch/hermes-agent/blob/main/skills/note-taking/obsidian/SKILL.md)。

建议 Vault 结构：

```text
knowledge/ObsidianVault/
├─ 00-Inbox/
├─ 10-Assets/
├─ 20-Procedures/
├─ 30-Incidents/
│  ├─ Printers/
│  ├─ Windows/
│  └─ Network/
├─ 40-Drivers/
├─ 50-Environments/
└─ 90-Templates/
```

每次任务至少可生成一份结构化记录：时间、设备、目标、环境、执行步骤、结果、错误、解决办法、证据、关联 Skill、敏感信息脱敏情况。

Obsidian 应视为 Markdown 浏览/编辑器，而不是知识库数据格式本身；即使宿主机没有安装 Obsidian，Hermes 和工作台仍可使用 Vault。

### R-006 Memory、知识库与 Skill 分工

| 层 | 保存内容 | 示例 |
|---|---|---|
| Memory | 小而稳定的事实、偏好和环境提示 | 常用打印服务器、用户偏好 PowerShell |
| Obsidian | 人可读的长期知识、案例和证据 | 某型号打印机安装记录、故障复盘 |
| Skill | 可重复执行、可参数化、可验证的流程 | 安装 TCP/IP 打印机、重置打印队列 |
| Session / Log | 单次对话、工具事件和完整审计 | 本次命令、输出、审批、耗时 |

官方对 Skills 与 Memory 的区分也是“程序性知识”与“事实性知识”，详见 [Working with Skills](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/guides/work-with-skills.md)。

禁止将含密码、API Key、代理订阅、私人信息或未经审查的原始日志自动写入 Memory、Skill 或 Vault。

### R-007 运维 Skill 学习闭环

任务完成后提供：

```text
[保存操作记录] [生成可复用 Skill] [暂不保存]
```

生成 Skill 不能只是复制历史命令，必须经过：

1. 提取变量：IP、打印机名、驱动名、端口名、域名等。
2. 定义前置检查：系统版本、架构、管理员权限、网络可达性。
3. 定义步骤和幂等性：重复执行不能破坏现有配置。
4. 定义验证：查询安装结果、打印测试页或检查服务状态。
5. 定义回滚：删除新建端口/打印机、恢复服务配置。
6. 脱敏与人工审核。
7. 记录版本、来源任务、适用范围和最后验证日期。

建议 Skill 状态：`draft → reviewed → trusted → deprecated`。只有 `trusted` Skill 才允许在低风险范围内减少确认步骤；涉及驱动、系统服务或管理员权限时仍需明确审批。

### R-008 工作台套壳界面

建议一级导航：

- AI：Hermes 会话和任务入口。
- 工具：打印机、网络、Windows、Office 等任务卡片。
- 任务：运行中、等待审批、失败、已完成。
- 知识库：浏览/搜索/打开 Obsidian Vault。
- Skills：查看、生成、审核、测试、版本管理。
- Terminal：Hermes CLI/TUI、PowerShell、CMD。
- 设置：模型/API、代理、路径、安全、更新与诊断。

工作台不是单纯“套一个终端窗口”。它负责用户体验、任务编排、结构化进度、审批、安全和审计；Hermes 负责推理、工具和状态。

### R-009 CLI / TUI / WebUI 调用

保留以下入口：

- Open Hermes CLI
- Open Hermes TUI
- Open Hermes Desktop
- Open Hermes Web Dashboard
- Open PowerShell / CMD
- 打开工作目录、日志目录和知识库

这些入口用于高级操作、故障恢复和上游能力复用，不作为工作台读取任务状态的唯一接口。

### R-010 打印机安装与任务进度

进度界面示例：

```text
安装网络打印机：财务部 HP M428

✓ 环境与权限检查
✓ 检测打印机网络
✓ 确定驱动来源
● 从本地仓库校验驱动       68%
○ 安装驱动
○ 创建 TCP/IP 端口
○ 创建打印机
○ 打印测试页
○ 保存操作记录

当前状态：正在校验本地 HP 驱动包
[暂停] [取消] [查看详细日志]
```

实现要求：

- 后端事件至少包含 `task_id`、`step_id`、状态、时间、消息、可选百分比、日志引用和错误代码。
- 不是每一步都有真实百分比；无法计算时使用进行中状态，不伪造进度。
- 支持 `pending / running / waiting_for_user / succeeded / failed / cancelled / rollback_running / rolled_back`。
- 取消必须是协作式取消；对正在安装的驱动不能简单杀进程后宣称已恢复。
- 管理员操作触发 UAC，工作台必须提前说明原因和影响。
- 优先从 U 盘本地资源仓库匹配驱动；本地不存在时，只有经用户同意才从厂商官方来源下载。
- 无论本地还是在线来源，都必须验证数字签名或 SHA-256，并记录实际使用的包版本。

### R-011 Portable AI 环境初始化器

需求：提供可重复、可审计的环境初始化功能，减少人工复制文件、写死路径和测试环境不一致。

初始化器只管理 Portable AI 专用目录，不负责自动格式化整块 U 盘。磁盘格式化具有破坏性，继续由用户使用 Windows 工具手动完成；初始化器只检查并提示文件系统、容量、写入权限和风险。

支持三种模式：

1. **开发测试目录**：初始化到普通文件夹或临时目录，不要求真实 U 盘。
2. **U 盘部署**：在用户选择的可移动磁盘中创建独立的 `Portable-AI/` 目录。
3. **恢复已有环境**：检测已有数据，只修复或重建程序与 runtime，不覆盖凭据、Profiles、Sessions、Memory、Skills、Vault 和本地资源仓库。

初始化流程：

```text
选择目标目录
→ 检查目标类型、文件系统、空间和写权限
→ 显示将创建/修改的内容
→ 创建标准目录结构
→ 安装固定版本的 Hermes 与运行环境
→ 校验下载文件的签名或 SHA-256
→ 创建默认 Profile、Workspace 和 Obsidian Vault
→ 建立空的本地资源仓库与索引
→ 可选配置 API、代理和凭据库
→ 执行便携性与健康检查
→ 输出初始化报告
```

维护操作：

- **检查/修复环境**：只补齐缺失或损坏文件。
- **重建 Runtime**：重建程序环境，默认保留全部用户数据和本地资源。
- **恢复出厂环境**：先生成备份，再经二次确认清空用户数据。
- **导出诊断报告**：列出版本、路径、哈希、空间和测试结果，不包含密钥。

开发与测试顺序：

1. 在普通目录中实现和测试初始化器。
2. 使用临时目录反复执行初始化、修复、重建和幂等性测试。
3. 使用 Windows 虚拟磁盘或专用测试盘验证盘符变化、断连和空间不足。
4. 使用无重要资料的真实 U 盘测试 exFAT/NTFS、路径含空格和非 ASCII 字符。
5. 使用移动 SSD 进行性能和大量小文件测试。
6. 最后验证升级、失败回滚、备份恢复和宿主机落地文件审计。

验收标准：重复执行不会覆盖用户数据；失败不会留下“表面成功”的半初始化状态；所有步骤有日志和明确结果；目标路径必须处于用户明确选择的专用目录内。

### R-012 U 盘本地资源仓库

需求：预先保存打印机驱动、常用运维工具和离线安装包，使工作台在网络受限、下载缓慢或厂商页面变化时仍能完成任务。

这里的“仓库”首先是 U 盘内的**结构化制品仓库**，不要求一开始就搭建 Git 服务或数据库。二进制包不建议直接提交到普通 Git 历史；Git 可用于版本管理清单、脚本和元数据，较大的驱动包由文件目录保存。

建议结构：

```text
repository/
├─ repository-index.json
├─ manifests/
│  └─ printer-drivers.json
├─ drivers/
│  ├─ hp/universal-pcl6/7.1.0/windows-x64/
│  │  ├─ package.zip
│  │  ├─ package.json
│  │  └─ SHA256SUMS
│  └─ canon/...
├─ tools/
│  ├─ sysinternals/...
│  └─ diagnostics/...
├─ packages/
└─ quarantine/
```

每个 `package.json` 至少记录：

- 唯一包 ID、厂商、产品/型号、版本和发布日期。
- 支持的 Windows 版本、CPU 架构、驱动类型和硬件 ID。
- 安装入口、静默参数、是否需要管理员权限、退出码含义。
- 原始下载 URL、获取日期、许可证或再分发限制。
- 文件 SHA-256、数字签名发布者和签名验证结果。
- 已验证环境、最后测试日期、已知问题和回滚方式。

仓库工作流：

```text
导入厂商驱动
→ 放入 quarantine
→ 计算哈希并验证数字签名
→ 录入兼容性元数据
→ 在测试机验证
→ 标记 trusted
→ 加入正式索引
```

安装任务只自动选择 `trusted` 包，并按硬件 ID、Windows 版本、架构和优先级匹配；若出现多个候选，应显示差异并让用户选择。仓库缺少匹配包时，可建议在线获取，但不得从不明镜像自动下载。

需要注意厂商驱动的再分发许可证。若许可证不允许随项目发布，初始化器应支持用户自行导入到私人 U 盘仓库，而公开发行包只包含清单模板和导入工具。

### R-013 统一日志目录与来源目录

需求：为后续日志 UI 提供稳定的 Portable 相对路径和结构化来源目录，同时保留 Hermes 与 Runtime 的原生文件所有权。

- 顶层 `logs/` 保存 Workbench 自己生成的初始化报告、启动器事件、Setup/Doctor/更新观察记录、诊断和导出文件。
- Hermes/Gateway 日志及官方更新回执继续位于 `data/logs/`；Runtime manifest 和 Hermes source state 继续位于各自组件目录，不为了界面统一而复制成多个权威版本。
- `manifests/log-sources.json` 作为未来日志 UI 的机器可读目录，将分散的权威来源聚合为一个逻辑视图。
- 日志只保存历史证据；PID、锁、凭据、Sessions、数据库和实时配置不得移入日志目录。
- 原始日志默认视为可能敏感，不进入 Git、不自动同步；诊断导出必须采用允许列表、脱敏并由用户确认。

## 6. 安全与便携性底线

### 6.1 凭据保护

当前 Portable 项目将 API Key 放在便携目录的 `.env`，U 盘遗失会直接暴露密钥。需要设计两种模式：

- 便携模式：主密码解锁加密凭据库，运行时短暂注入子进程环境。
- 绑定本机模式：可选使用 Windows DPAPI，但应明确说明换电脑无法解密，不适合作为默认 USB 模式。

日志必须遮蔽 API Key、Authorization Header、代理订阅 URL、Cookie 和内部密码。

### 6.2 权限与审批

风险等级建议：

| 等级 | 示例 | 默认策略 |
|---|---|---|
| L0 只读 | 查询系统、Ping、读取打印机列表 | 可直接执行 |
| L1 可逆用户级 | 打开应用、创建普通文件 | 执行前摘要或按策略放行 |
| L2 系统变更 | 安装打印机、修改服务、写注册表 | 必须明确审批 |
| L3 高风险 | 删除驱动、关闭安全功能、批量改系统 | 二次确认并要求回滚方案 |

### 6.3 供应链与更新

- Python、Node、Git、Mihomo 等 Runtime/工具制品使用受审查的版本并校验 SHA-256/签名。
- Hermes 不永久锁死：manifest 中的版本是可重试的 bootstrap 基线，用户可主动更新到新版本。
- 首次安装使用经审计的官方稳定 Release；后续更新复用官方 `hermes update` 并保持其默认 `origin/main` 行为。官方当前没有按“最新稳定 Release tag”自动推进的独立通道，P0 不自造一个不受上游支持的通道。
- Portable 启动器在应用前依次暴露官方 `--check`、`--plan` 和明确确认，不传入 `--yes`、`--no-backup`、`--force` 等绕过安全控制的参数。
- 官方更新器负责 quick 状态快照、依赖更新、配置迁移、关键文件语法验证、代码自动回退和更新回执；项目不重复维护自有 Git 更新器。回执位于便携 `HERMES_HOME/logs/update_receipts/`。
- 每次 Hermes 更新的实际版本、commit、通道和结果用于诊断和回滚，不用于阻止新版本。Windows Portable 包装器校验 origin、保留官方交互、记录 transcript 与脱敏摘要，并在成功后刷新 Runtime manifest/组件回执；仍需通过 Windows 实机验证数据保留和便携边界。
- 保存第三方组件来源、版本、许可证和哈希清单（SBOM/manifest）。

### 6.4 “零宿主污染”的真实定义

需要通过测试证明，而不是只依赖环境变量。测试应覆盖：用户目录、AppData、Temp、注册表、服务、计划任务、开始菜单、桌面快捷方式、浏览器缓存和崩溃日志。安装打印机本身当然会修改宿主系统，应与“应用运行数据是否便携”分开描述。

## 7. 分阶段实施路线

### P0：基线与快速改进

- [x] 先实现目录模式的最小初始化器和标准目录结构。
- [ ] 完成初始化、修复、重建 Runtime 和数据保留测试（初始化和数据保留已覆盖；组件回执、暂存恢复和失败状态已实现并通过 PowerShell 7 本地测试，Windows 实机修复/重建尚待验收）。
- [x] 建立可重复测试的 `feat/portable-initializer` 分支。
- [ ] 完成 Runtime 归档完整性和 Hermes 可更新基线（Windows x64 归档哈希、Hermes bootstrap commit、完整 Win10/exFAT 首次安装和幂等启动已验证；Hermes 更新/回退实测、Python 传递依赖锁和许可证/SBOM 尚待完成）。
- [ ] 移植 Desktop 菜单项。
- [ ] 增加 CLI、TUI、Dashboard、Desktop 独立入口。
- [ ] 修正便携 Git 的 PATH、默认工作目录和盘符变化问题。
- [ ] 完成宿主机落地文件审计。

P0 当前验证证据：初始化器与组件锁测试在 GitHub Actions `windows-latest` 上同时覆盖 Windows PowerShell 5.1 和 PowerShell 7；用户已在 Win10/exFAT U 盘完成核心 Runtime 首次安装，验证精确 Hermes commit、ready/manifest 和重复启动不再 Setup。P0-10 的 fail-closed 组件验证已通过 GitHub Actions run `33776790273`；P0-07 更新观察层的 PowerShell 7 本地三路径模拟及七组测试已通过，GitHub Actions run `33783429258` 的 Windows PowerShell 5.1/7 也全部成功。两者仍待 Win10/exFAT 实机恢复/更新矩阵；开发阶段没有执行磁盘格式化、Full Reset、真实打印机安装或凭据配置。

### v0.8 — 2026-09-04

- 为 Windows 官方 Hermes update 增加 Portable 观察层：校验受审计 origin、使用 portable venv、保留交互式安全控制并记录完整 transcript。
- 增加不复制官方 argv/步骤详情/配置的更新摘要，记录前后版本和 commit、通道、结果及官方回执关联；成功后刷新 Runtime manifest 与源码/依赖回执。
- Unix 更新应用纳入统一 transcript；Doctor/检查/计划修正为使用安装了 Hermes 依赖的 portable venv。
- 本地模拟验证成功、未审计 origin 拒绝和官方非零退出传播；GitHub Actions run `33783429258` 的 Windows PowerShell 5.1/7 七组测试通过。

### P1：远程 API、代理与知识库

- [ ] 完成多连接/多模型配置原型。
- [ ] 完成直连、系统代理、自定义代理的测试矩阵。
- [ ] 评估可选 Mihomo Core 管理方式。
- [ ] 建立 Obsidian Vault 模板并接入 `OBSIDIAN_VAULT_PATH`。
- [ ] 完成凭据加密方案 PoC。
- [ ] 建立本地资源仓库格式、索引生成器和导入校验流程。

### P2：工作台 MVP

- [ ] 验证 `hermes serve` 协议、事件和兼容性边界。
- [ ] 实现启动/停止/健康检查和断线重连。
- [ ] 实现对话、工具活动、日志与用户审批。
- [ ] 实现任务步骤状态机和取消机制。
- [ ] 实现“打开 CLI/TUI/Desktop/WebUI”的备用入口。

### P3：打印机安装试点

- [ ] 选择一个明确场景：Windows 10/11 x64 + TCP/IP 网络打印机。
- [ ] 实现发现、连通性、驱动、端口、安装、验证和回滚。
- [ ] 导入至少一个已授权的打印机驱动包并生成完整 manifest。
- [ ] 实现本地驱动匹配、签名/哈希验证和在线缺包提示。
- [ ] 生成脱敏任务记录。
- [ ] 从成功案例生成 draft Skill，并建立人工审核流程。

### P4：成熟化

- [ ] Skills 版本、测试、信任状态和回滚。
- [ ] 加密备份与恢复。
- [ ] 离线诊断包（不含模型）。
- [ ] 自动更新与失败回滚。
- [ ] Windows 版本、权限、代理和硬件兼容矩阵。

## 8. 关键验证问题

以下问题在编码前或原型阶段必须得到实测答案：

1. `hermes desktop` 在重定向 AppData 后是否仍会写入宿主用户目录？
2. Desktop、CLI 和工作台能否同时访问同一 Profile，还是必须加单实例/写锁？
3. `hermes serve` 的协议是否有版本标识、稳定事件结构和取消接口？
4. Hermes 工具调用能提供哪些原生进度信息？哪些任务需要由自有工具包装器上报步骤？
5. 远程 API、Git、浏览器、Gateway 和下载器是否都一致继承代理？
6. UAC 提升后是否保留必要的便携环境变量和工作目录？
7. Windows 驱动安装失败时，哪些步骤可安全回滚，哪些只能提示人工处理？
8. 加密凭据如何在子进程生命周期结束后清理，崩溃时是否残留？
9. USB 拔出、睡眠、盘符变化或瞬时断连时，数据库和 Vault 如何防损坏？

## 9. 决策记录

### ADR-001：选择远程 API，而非本地模型

- 日期：2026-09-02
- 状态：Accepted
- 原因：降低包体积、硬件要求、模型维护成本；更符合日常运维场景。
- 影响：网络和代理成为核心基础设施；必须保护 API 凭据。

### ADR-002：工作台使用结构化后端接口

- 日期：2026-09-02
- 状态：Proposed，待 PoC 后确认
- 选择：优先 `hermes serve` JSON-RPC/WebSocket。
- 放弃：解析 CLI/TUI stdout 作为主要集成方式。
- 原因：终端输出不是稳定 API，难以可靠表示任务步骤、审批、取消和错误。

### ADR-003：知识三层分工

- 日期：2026-09-02
- 状态：Accepted
- 选择：Memory = 事实；Obsidian = 长期文档；Skill = 可执行流程。
- 影响：任务结束需要分类、脱敏和人工审核，而非自动把所有历史写成 Skill。

### ADR-004：不默认捆绑 Clash Verge

- 日期：2026-09-02
- 状态：Proposed
- 选择：系统/自定义代理为基础，可选便携 Mihomo Core；Clash Verge 仅作为外部高级方案。
- 原因：减少体积、系统修改、权限、WebView/TUN 和维护责任。

## 10. 后续更新规范

每次修改本备忘时：

1. 更新“最近更新”和文档版本。
2. 新需求分配唯一编号 `R-xxx`。
3. 重大技术选择增加 `ADR-xxx`，保留被替代决策，不直接删除历史。
4. 需求状态使用：`Idea / Proposed / Accepted / In Progress / Verified / Deferred / Rejected`。
5. 实现完成必须附测试证据、适用版本和已知限制。
6. 将讨论中的事实、建议和待验证推测明确分开。

## 11. 变更日志

### v0.8 — 2026-09-04

- 实现 P0-10 可验证组件回执与既有成功 Runtime 的无重装回执迁移；回执损坏、锁变化或真实安装验证失败时只重建对应步骤。
- Hermes 受管暂存仓库可跨失败运行复用，修复流程保留用户通过官方来源主动更新后的 commit，不把 Hermes 永久锁死在 bootstrap 版本。
- 启动器补充核心文件与 `ready.flag` 后置条件、正确失败提示和恢复指引；Playwright 可选安装获得独立诊断日志并登记到日志来源目录。
- 新增恢复状态自动化测试并纳入 Windows PowerShell 5.1/7 CI；本地 PowerShell 7 及 GitHub Actions run `33775881283` 均通过，Windows 实机恢复/Soft Reset 仍待验收。

### v0.7 — 2026-09-03

- 完成 P0-09 Win10/exFAT U 盘核心 Runtime 首次安装与幂等启动实机验收。
- 验证 Runtime 归档缓存/完整性、目录移动重试、portable Git 精确信任、Hermes bootstrap commit、venv 和依赖安装。
- 记录后续 P0-10 缺口：组件级续跑、Hermes 暂存恢复、取消/失败退出，以及 Playwright 可选安装的独立诊断日志。

### v0.6 — 2026-09-03

- 新增 R-013：顶层 `logs/` 作为 Workbench 统一日志入口，并增加机器可读日志来源目录。
- 保留 `data/logs/`、Runtime manifest 和 Hermes source state 的原生权威位置，避免破坏上游更新及产生重复状态。
- 增加启动器结构化事件和 Setup、Doctor、更新检查/计划的持久记录；真实 Windows 内容仍待实机验证。

### v0.5 — 2026-09-03

- 审计 Hermes Agent `v0.21.0` 官方更新实现，确认其默认跟随 `origin/main`，已经具备检查、计划、快照、迁移、验证、代码回退和回执能力。
- P0-07 调整为复用官方更新器：Portable 启动器只增加只读检查、计划和用户确认，不重复开发一套更新/回退系统。
- 澄清“稳定 Release”是首次安装 bootstrap 选择，不再宣称上游尚未提供的自动稳定 tag 更新通道。

### v0.4 — 2026-09-03

- 增加 `docs/PROJECT-PLAN.md` 作为当前 P 阶段、任务 ID、状态和验收条件的唯一进度入口。
- 确认开发策略为“继承原项目，不重写已经可用的便携启动能力”。
- 将 Hermes 策略从“永久固定”修正为“bootstrap 可重试、后续可主动更新、实际版本可审计与回退”。
- 明确当前 P0-07 是 Hermes 更新、健康检查、数据保留和失败回退验证。

### v0.3 — 2026-09-02

- 记录已确认的 Fork、`feat/portable-initializer` 开发分支和 P0 实现状态。
- 记录普通目录最小初始化器、数据保留行为与 PowerShell 5.1/7 CI 验证。
- 新增 Windows x64 Runtime 组件锁，固定归档哈希/大小和 Hermes Git commit；当时限制浮动 `main` 的策略已在 v0.4 被“可控更新”决策取代。
- 明确当前限制：完整 Windows Runtime 安装、修复/重建和宿主落地审计尚待实机验证。

### v0.2 — 2026-09-02

- 新增 Portable AI 环境初始化器需求、三种模式、维护操作与完整开发测试顺序。
- 明确初始化器不自动格式化整块 U 盘。
- 新增 U 盘本地驱动/工具制品仓库、目录规范、包清单、信任流程和许可证约束。
- 将打印机任务调整为优先使用本地可信驱动包，缺包时再经用户同意访问厂商官方来源。

### v0.1 — 2026-09-02

- 建立长期维护文档。
- 收录远程 API、多模型/API 管理、代理、Hermes Desktop、Obsidian、Memory/Skill 分工、运维学习闭环、工作台、CLI/WebUI 入口和打印机进度展示需求。
- 记录 `Local-Hermes-Portable` 已有 Desktop 菜单实现与主仓库差距。
- 增加安全、供应链、便携性底线、实施路线和关键验证问题。
