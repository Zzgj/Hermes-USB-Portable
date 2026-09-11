# P2 模型接力交接（2026-09-11）

## 1. 本次交接目标与事实来源

另一模型接手功能实现、自测和文档更新；完成一批后交回 Codex 审查、修改和回归。
不要求用户在开发过程中反复插 U 盘，也不将开发快照当成 RC。

P2 开发完成度当前粗估 **60%～65%**，不是加权精确统计，也不是全项目或验收完成率。
70% 是下一开发里程碑，不允许靠修改百分比、删任务或增加测试数量宣告达到。
P0 RC2 仍待最终实机验收；P3 的真实 Agent/Skill 内容、试跑和跨电脑验证仍由 Hermes 负责。

来源优先级：实际代码与本次运行结果 → 最新 [VALIDATION.md](VALIDATION.md) →
[PROJECT-PLAN.md](../PROJECT-PLAN.md) 的 P2 条目 → 历史描述。
旧文档和旧聊天可能有过期状态；出现冲突应核对并记录，不任选一个当事实。

## 2. 接手时最重要的工作区说明

- 当前路径：`/home/zgj/桌面/CodeRepository/Hermes-USB-Portable`。
- 分支：`feat/portable-initializer`。
- 交接整理前 Git HEAD：`540d4442eb60c0f12548e79a274f5ce28deef97f`，**这不是 P2 完整代码快照**。
- 随本地 `chore: checkpoint P2 development for model handoff` 提交，纳入此前未跟踪的 P2 源码、测试、脚本和文档；接手时用 `git log -1` 核对实际交接提交，用 `git status --short` 检查后续改动。此提交不是 RC，也未因此自动推送远程。
- 仅克隆 HEAD、仅发送 `git diff` 或只传源码中的几个文件，会丢失大量 P2 工作。
- 不运行 reset/clean/checkout 覆盖现场；不要把未跟踪文件当临时垃圾删除。
- docs 旧文件删除属于此前按用户要求迁入 `docs/p0/` 的整理，不能擅自恢复或清理。
- 用户已授权本次本地交接提交；接手模型不因此获得后续 commit、push、发布、修改个人 Hermes 配置或执行真实系统运维的授权。

同一电脑：让接手模型直接访问当前工作区，避免双方同时写文件。开始前记录 `git status --short`。
另一环境：交付完整开发文件副本，而不是 RC 安装包。至少包含 `workbench/src`、`scripts`、`tests`、
`resources`、前端配置及 package/lock 文件、兼容性清单、根项目脚本/清单和 docs。
若做视觉校准，再提供经检查的 `.stitch` 设计资料。
不要打包个人 `.env`、令牌、用户数据、日志、运行时缓存或 `node_modules`；排除前先确认文件用途。
保留原工作区副本，转移后核对开发文件数量/哈希。本文不代表已经生成或校验了迁移包。

## 3. 产品边界

项目是 **Hermes 工作流 Agent + 适配 WebUI + U 盘工程能力**。
卡片代表可复用方法入口，不是固定打印机业务，也不是新建 n8n/DAG 调度器。
Hermes 决定和执行具体步骤；工作台负责输入、确认、状态、证据和复用入口。

- 一张卡片可以引用 Skill/Bundle，但 Bundle 不等于确定顺序的 DAG。
- 草稿生成、模型轮次结束、命令返回 0，都不等于业务验证成功。
- `/learn` 由 Hermes 产出内容；本项目不再造学习引擎。
- 失败经验可沉淀，不得自动发布为成功方法。
- 方法指纹/环境变化需要复验，不能复制旧电脑凭据或授权。
- 取消不等于撤销；外壳安装恢复不等于业务任务回滚。

## 4. 当前代码地图与真实状态

| 区域 | 主要文件（相对 workbench/） | 已实现 / 仍缺少 |
|---|---|---|
| 应用与连接 | src/App.tsx、hooks/useLiveChat.ts、domain/rpc.ts | 内部切页保留连接；刷新/重连不恢复；不能自动重发 |
| 真实聊天 | pages/LiveChatPage.tsx、domain/chat-events.ts、domain/approval.ts | 流式轮次、工具活动、单次批准/拒绝、中断；完整真实工具链待验 |
| 真实任务 | pages/LiveTasksPage.tsx、domain/task-summary.ts | `/tasks` 展示观测状态；模型完成不推断业务成功；暂无持久化 |
| 模拟页面 | pages/ChatPage.tsx、pages/TasksPage.tsx、domain/workflow.ts | `/chat` 和 `/tasks/demo` 是夹具；不要扩展成生产执行器 |
| 历史与配置 | domain/session-history.ts、session-list.ts、profiles.ts、skills.ts | 最近 50 条正文只读、Profile/Skill 摘要；resume、选择/写配置未实现 |
| 能力卡片 | pages/CapabilitiesPage.tsx、domain/capability.ts | 导入/导出、参数预览、纯验证规则；真实执行按钮仍禁用 |
| Skill 目录 | scripts/skill-catalog.mjs、components/ServiceControls.tsx | 固定 home/skills 子树指纹、导出草稿后人工导入；无自动同步、Bundle 或可用性核验 |
| 学习请求 | scripts/prepare-learn.py、prepare-learn.mjs、src/domain/learn.ts | 上游纯构造器准备→全文审阅→确认提交；产出发现、变更审阅、复验/持久化未完成 |
| 服务管理 | scripts/control-server.mjs、launch-managed.mjs、hermes-instance.mjs、owned-process.mjs、instance-lock.mjs | 本机认证、自有实例、健康检查及停止；Windows 实机进程树待验 |
| 打包恢复 | scripts/build-p2-package.mjs、package-policy.mjs、install-p2-package.mjs | 白名单/哈希/备份/恢复开发实现；仅 development-snapshot，非 RC |
| 更新/视觉 | pages/SettingsPage.tsx、src/styles.css、resources/ | 双通道更新仍占位；Stitch 校色、响应式和完整无障碍待做 |

根目录 Windows 入口为 `scripts/start-p2-workbench.ps1`、`scripts/install-p2-package.ps1`。
新后端文件必须同步 `package-policy.mjs`，避免本地能跑、包里缺文件。

## 5. 当前验证基线及不能推导的结论

上一开发批次通过：**102 项 Node 测试、16 个组件 AST 检查、TypeScript 与 Vite 生产构建**。
本交接文档整理本身不代表再次执行所有测试；接手后应重跑获取自己的基线。

已有 Linux 隔离探针与部分合成 RPC 浏览器验证，详细范围见 VALIDATION。
Skill 目录新导出入口的浏览器操作、Windows 行为尚未验；真实个人 Skill 未被读取。
学习请求浏览器验证使用合成后端，不是实际模型生成/落盘 Skill 的证明。
已有 P0 原生 Web/TUI 的用户成功记录，不能替代新 P2 的验收。

在 `workbench` 目录运行：

```bash
npm test
npm run validate
npm run build
```

需要 Node >=22.12；已有依赖时不要为“标准做法”重装 Hermes 或运行 uv sync。
若新环境缺前端依赖，核对 package-lock 后使用 npm ci；记录网络失败，不随意升级锁文件。
浏览器开发预览可用 npm run dev，真实实验启动与隔离方式见 EXPERIMENTAL-LAUNCH、SERVICE-LIFECYCLE。
没有真实环境时应写“未验证”，不能伪造探针或用模拟结果替代实测。

## 6. 上游适配的重要陷阱

开发基线记录为 Hermes `28044757aabd34010bd9f5f3e3f82b0906b46241`；
bootstrap `29112bef...`、历史 U 盘 `f58fcc81...` 是不同身份。相同 `0.21.0` 不能证明契约一致。
`hermes-compatibility.json` 的 `release_ready:false` 必须保持，除非完成对应发布门禁。
个人源码曾位于 `/home/zgj/.hermes/hermes-agent`：仅作经授权的源码查阅，不要用其个人 home 联调。

1. `command.dispatch` 会先处理快捷命令/插件，可能先执行 shell，再返回结果；不能当只读能力探测。
2. 现有 learn helper 仅执行 SHA256 锁定的纯 `agent/learn_prompt.py` 字节；未知版本失败关闭。
   不要为兼容删掉指纹校验或回退到 dispatch。提示中的“先确认”不是强制文件沙箱。
3. `agent/skill_commands.py` 的构造路径包含 skill_view / 使用计数；Bundle 构造也可能写使用计数、跳过成员。
   真实卡片调用前重新审计，不得把有副作用的调用包装成只读预览；不接受悄悄跳过成员的假成功。
4. Profile 列表明确 `include_sessions:false`，避免会话发现时恢复归档数据。
5. 历史 GET 不是 resume；resume 可能继续执行，必须另行确认与防重放。
6. 当前 Skill 子树指纹只是快照，不能证明可执行、可信或无恶意。执行前重验方法及环境。
7. `/mingw64/bin/git` 是 Git Bash 内部路径，不凭此判断借用宿主；要核对实际可执行与实例归属。

## 7. 建议接力方案（不要一轮无边界重写）

### A 批：优先交回审查——真实能力卡片最小闭环

对应 P2-16/17，先支持单 Skill；Bundle 未核实就明确不支持，不伪装完成。

1. 接通实例草稿与现有卡片，保持来源身份、方法指纹与当前实例绑定。
2. 确认前展示目标、参数、适用性/依赖的已知与未知状态、费用及可能的工具操作。
3. 提交前重核指纹，缺失/变更/连接切换应拒绝或要求重新审阅；不要仅信任导入 JSON。
4. 用经审计的 Hermes 机制执行，关联真实 session/轮次与卡片；一次确认至多发送一次。
5. 结果显示观测到的状态；没有业务验证证据时保持未验证，不自动发布。
6. 测试取消、失败、断线、迟到结果、重复点击及切换卡片/实例；支持返回聊天审批。

交付门：无模拟成功、无任意路径/命令转发、无令牌持久化；自动测试通过，并说明浏览器/真实服务验证边界。
这批完成并不自动表示整个 P2 已完成，也不单凭它宣告精确 70%。

### B 批：学习产出与验证记录

对应 P2-18/19：关联学习请求与实际文件产出，展示变更供审阅；设计最小可迁移记录，保留来源、
方法/环境指纹、验证时间和会话关联。不要保存密钥、完整敏感工具参数或长期审批。
先提交存储位置/格式/迁移与写入权限方案再扩展；不能仅凭模型自述生成“可信验证”。
生成与重新运行验证分离；旧证据保留，修改方法触发复验；导入外部记录不直接授信。

### C 批：配置、更新及交付收尾

- P2-12/13：最小 Profile/Skill 选择，明确接口副作用，不造平行配置体系。
- P2-15：内核/外壳独立来源与版本；检查、通知、确认安装分开。离线退避、失败说明、兼容门禁不可省略。
- P2-05/08：需要恢复时核对上游实际接口，不自动继续历史任务。
- P2-09/11：原生备用入口、错误恢复、视觉/键盘/窄屏/高 DPI。
- P2-14：完成适用门禁后才准备集中测试候选包、可信哈希、清单和已知限制。

建议 A 批就交回 Codex，避免将安全敏感的执行/存储/更新修改全部堆到一次大审查。
纯视觉工作可另批处理；不得为了减少调用次数省略必要审查。

## 8. 接手模型的工作纪律

- 先读仓库/环境 AGENTS.md；使用 apply_patch，保留现有改动。
- 不在个人 Hermes、宿主服务或真实打印机/AD 上做开发试验；使用合成夹具/隔离实例。
- 不全局结束 Python/Node、不擅自删除锁、不升级源码以绕过兼容问题。
- 不自动安装 MCP/Skill，不保存 API Key，不开放局域网监听，不放宽认证/Origin/文件白名单。
- 管理员操作先做无需提权检查，再说明范围风险；该用户环境统一使用 pkexec，不开长期 root shell。
- 在 docs 记录实现、自动测试、模拟浏览器、隔离真实接口、Windows 实机五类证据，不能混写“通过”。

## 9. 交回 Codex 的材料

使用 [RETURN-REPORT-TEMPLATE.md](RETURN-REPORT-TEMPLATE.md) 填写交付报告。
同工作区保留全部改动；异地交回必须包含新增文件（仅 git diff 不够）。
附文件清单、实际命令与退出结果、失败项、接口/存储决策、未验证边界及下一步。
不要附令牌、个人聊天正文或密钥。不要在没有测试包的情况下声称已发布。

Codex 回接顺序：核对完整文件 → 检查变更与授权边界 → 审查认证/路径/实例绑定/防重放 →
审查真实状态与证据 → 重跑测试及针对性整合检查 → 修正问题 → 更新清单/判断能否集中验收。
接手模型的“全部通过”和完成百分比都只是待审查声明，不自动继承。
