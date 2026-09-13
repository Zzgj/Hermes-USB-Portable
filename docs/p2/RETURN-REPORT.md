# P2 接力开发回交报告

## 基线与范围

- 接手日期、环境、Git HEAD：2026-09-13，Windows（当前工作机），`aecd17d`（`chore: checkpoint P2 development for model handoff`），分支 `feat/portable-initializer`，未推送远程。
- 本轮任务批次/编号：A 批——真实能力卡片最小闭环（P2-16/17）；B 批——验证证据与学习产出关联（P2-18/19）；C 批——配置/更新/恢复安全/无障碍/打包收尾（P2-15/09/12/13/05/08/11/14）；D 批——localStorage 持久化层、合成浏览器测试夹具扩展、跨模块集成测试。
- 接手时已有修改/未跟踪文件如何保留：交接提交纳入了此前未跟踪的 P2 源码、测试、脚本和文档；本轮所有改动叠加在工作树上，未运行 reset/clean/checkout，未删除任何既有文件。
- 完成项（实现，不是计划）：
  - **A 批（P2-16/17）**：
  - 新增 `capability-execution.ts` 域模块：指纹重核（`verifyMethodFingerprint`，按方法名比对 match/mismatch/missing）、提示构造（`buildExecutionPrompt`，生成 `prompt.submit` 使用的自然语言提示，非 `command.dispatch`）、执行阶段推导（`deriveExecutionPhase`，idle/verified/mismatch/missing/observing/complete/failed/interrupted/unknown）。
  - 在 `capability.ts` 新增 `readInstanceCatalogCards`：通过本机管理服务绝对地址 `http://127.0.0.1:{port}/api/capabilities/catalog` 读取实例 Skill 子树指纹，Bearer 认证、禁用 Cookie/重定向/缓存、流式限额 70 KiB、强制草稿投影。
  - 在 `useLiveChat.ts` 扩展：`loadInstanceCatalog`（epoch 防陈旧、catalogBusy 防并发、15s 超时、AbortController 可取消）、`prepareExecution`（重核指纹 + 构造提示）、`confirmExecution`（仅 match + 已确认 + 非 streaming 时发送一次 `prompt.submit`，`preserveExecution` 避免发送时清空）、`clearExecution`、`executionPhase` 派生值。`end()` 清空目录和执行状态。
  - 重写 `CapabilitiesPage.tsx`：接收 `chat` prop，展示实例目录读取按钮、指纹核对结果（match/mismatch/missing）、执行范围与风险审阅（适用性未知、费用警告、工具审批警告）、确认复选框 + 执行按钮、执行阶段状态、返回聊天审批入口。切换卡片清空参数和执行状态。
  - 在 `mockData.ts` 新增 `executionCopy`：全部执行 UI 文案，明确标注"模型轮次完成不等于业务验证"。
  - `App.tsx`：向 `CapabilitiesPage` 传入 `chat`。
  - 新增 13 项 `capability-execution.test.mjs` 测试 + 扩展 4 项 `capability.test.mjs` 测试，全部通过。
  - **B 批（P2-18/19）**：
  - 在 `capability.ts` 新增 `importVerificationDrafts`：外部导入的验证证据一律标记 `trusted:false`，不接受外部声明的 trust 字段；限额 128 KiB UTF-8 / 500 条记录；复用 `decodeVerification` 校验字段完整性。
  - 在 `capability.ts` 新增 `readInstanceEvidence`：通过 `http://127.0.0.1:{port}/api/capabilities/evidence` 读取实例验证证据，Bearer 认证、禁用 Cookie/重定向/缓存、流式限额 140 KiB、统一抛 `EVIDENCE_FAILED` 不泄露原始错误。
  - 在 `capability.ts` 新增 `environmentFingerprint`：从实例 Skill 目录的名称和指纹排序后用 `crypto.subtle.digest('SHA-256')` 生成环境指纹，绑定方法指纹与环境，方法或环境变更触发 `capabilityStatus` 返回 `reverify`。
  - 在 `useLiveChat.ts` 扩展：`loadInstanceEvidence`（evidenceBusy 防并发、epoch 守卫、15s 超时、AbortController 可取消）、`cardVerification`（结合 envFingerprint 和 evidence 派生卡片验证状态）。`loadInstanceCatalog` 成功后计算环境指纹。`end()` 清空证据状态和环境指纹。
  - 在 `CapabilitiesPage.tsx` 新增验证证据面板（读取按钮、证据列表、导入未授信提示）和学习产出关联提示（执行完成后引导用户重新读取实例目录检查 Skill 变更）。
  - 在 `mockData.ts` 新增 `evidenceCopy`：验证证据和学习产出关联的 UI 文案。
  - 扩展 8 项 `capability.test.mjs` 测试（导入信任投影、读取 URL 认证、响应限额、环境指纹稳定性和变更检测），全部通过。
  - **C 批（P2-15/09/12/13/05/08/11/14）**：
  - 新增 `update-check.ts` 域模块：UpdateChannel/CheckOutcome/UpdateSummary/UpdatePlan 类型，指数退避 `nextRetryDelay`（60s–3600s + 随机抖动），`decodeUpdateCheck`/`deriveUpdateOutcome`/`shouldRetry`/`decodeUpdatePlan`/`canInstall` 函数。离线/失败自动退避，不反复请求网络；兼容性门禁 blocked 时禁止安装。
  - 新增 `entry-detect.ts` 域模块：EntryKind/EntryStatus 类型，`entryLabel`/`decodeEntryStatus`/`decodeEntryList` 函数，拒绝重复和超限列表。
  - 新增 `resume-safety.ts` 域模块：ResumeWarning 类型，`deriveResumeWarning` 函数。恢复会话可能继续未完成的工具执行，必须明确确认；不自动恢复或重放。
  - 重写 `SettingsPage.tsx`：ChannelPanel 组件展示内核/外壳双通道检查→计划→安装确认流程（全部文案在 `updateCopy`，无静态 JSX 文本）；EntryPanel 组件展示入口检测按钮和结果列表（当前模拟返回空列表）。
  - 在 `LiveChatPage.tsx` 查看历史正文时显示 `deriveResumeWarning` 派生的恢复警告（`role="alert"`），明确标注"不自动恢复或重放"。Profile/Skill 面板已展示接口副作用警告。
  - 在 `Panel.tsx` 新增 `aria-busy` 属性支持；`SettingsPage.tsx` 的 ChannelPanel/EntryPanel 在检查/安装时设置 `aria-busy`。
  - 在 `mockData.ts` 新增 `updateCopy`（双通道更新和入口检测的全部 UI 文案）和 `liveCopy` 的 `resumeWarning`/`profileSideEffects`/`skillSideEffects`。
  - 新增 9 项 `update-check.test.mjs` 测试（退避边界、解码校验、结果映射、重试逻辑、安装门禁、入口标签、入口解码、入口列表去重、恢复警告），全部通过。
  - 验证 `package-policy.mjs`：新增文件均为前端源码（`workbench/src/domain/*.ts`），Vite 打包到 `dist/`，已被 `workbench/dist/**` 模式覆盖，无需修改白名单。
  - **D 批（localStorage 持久化、合成测试夹具、跨模块集成测试）**：
  - 新增 `capability-storage.ts` 域模块：`saveDrafts`/`loadDrafts`/`clearDrafts`（卡片草稿持久化，投影为 draft 状态，65KB 限额），`saveEvidence`/`loadEvidence`/`clearEvidence`（证据记录持久化，强制 trusted:false，128KB 限额，500 条上限）。版本化存储键 `hermes-p2-capability-drafts-v1` 和 `hermes-p2-capability-evidence-v1`；`getBackend()` 在 localStorage 不可用时安全返回 null，`loadDrafts`/`loadEvidence` 在损坏负载时返回空数组而非崩溃。
  - 扩展 `browser-rpc-fixture.js`：新增 `fetch` 拦截模拟 `/api/capabilities/catalog`（返回 fixture 卡片，availability:'unknown'）和 `/api/capabilities/evidence`（返回 fixture 证据记录）HTTP 响应；新增 `__p2FetchRequests` 记录数组。WebSocket 部分保持不变。
  - 新增 `capability-integration.test.mjs`：6 项跨模块集成测试覆盖完整执行链路——指纹匹配+验证证据+完成阶段=complete；指纹不匹配+环境变更=reverify；缺失技能=missing；断流期间断连=unknown；环境指纹顺序无关稳定性；失败证据保持 reverify。
- 未完成项与原因：
  - 真实会话结果关联：本轮未连接真实 Hermes 实例，无法验证端到端 `prompt.submit` → 模型回复 → 工具审批 → 终态的完整链路。
  - 后端 `/api/capabilities/evidence` 端点：客户端已实现读取逻辑，但 control-server 尚未实现该端点；客户端在 404 时返回 `EVIDENCE_FAILED`。
  - 可信证据采集和持久化：B 批只实现读取和导入投影，不采集或写入证据文件（C 批范围）。
  - 浏览器交互测试：未执行合成 RPC 浏览器测试。
  - Windows/USB 实机：未执行。

## 变更清单

| 文件（包括新增文件） | 变更目的 | 风险/审查重点 |
|---|---|---|
| `workbench/src/domain/capability-execution.ts`（新增） | 指纹重核、提示构造、执行阶段推导的纯逻辑模块 | `deriveExecutionPhase` 在 streaming+断线时归 unknown；`match`→`verified` 映射需确认是否与 UI phases 对象一致 |
| `workbench/src/domain/capability.ts`（修改） | 新增 `readInstanceCatalogCards`、`importVerificationDrafts`、`readInstanceEvidence`、`environmentFingerprint` | `environmentFingerprint` 使用浏览器 `crypto.subtle`，在 Node 22+ 全局可用；catch 块统一抛 `CATALOG_FAILED`/`EVIDENCE_FAILED`，不泄露原始错误 |
| `workbench/src/hooks/useLiveChat.ts`（修改） | 扩展实例目录读取、执行准备/确认/清除、执行阶段派生、证据读取、卡片验证状态派生 | `confirmExecution` 仅在 match + 未确认 + 非 streaming 时发送一次；`loadInstanceEvidence` 仅在目录已加载时可用；`cardVerification` 在 envFingerprint 或 evidence 未就绪时返回 `unknown` |
| `workbench/src/pages/CapabilitiesPage.tsx`（修改） | 接收 chat prop，展示指纹核对 + 执行审阅 + 确认 + 阶段状态 + 验证证据面板 + 学习产出关联 | `canExecute` 条件链需审查；证据面板仅在目录已加载时显示；学习关联提示仅在执行完成后显示 |
| `workbench/src/data/mockData.ts`（修改） | 新增 `executionCopy` 和 `evidenceCopy` 文案 | 文案明确标注"模型轮次完成（业务结果未验证）"、"外部证据一律未授信"和"连接中断，运行结果未知" |
| `workbench/src/App.tsx`（修改） | 向 CapabilitiesPage 传入 chat | CapabilitiesPage 现在依赖 chat hook，但不强制要求（chat 可选） |
| `workbench/tests/capability-execution.test.mjs`（新增） | 13 项执行逻辑测试 | 测试用合成 Capability/ChatTurn 对象，不连接真实服务 |
| `workbench/tests/capability.test.mjs`（修改） | 新增 4 项 readInstanceCatalogCards + 8 项证据/环境指纹测试 | 注入 mock fetch 验证 URL/headers/credentials/redirect/cache；验证限额和错误投影；环境指纹稳定性和变更检测 |
| `docs/p2/VALIDATION.md`（修改） | 记录 A+B 批测试结果 | 127 项（125 通过），2 项 Windows 预存失败未修复 |
| `docs/PROJECT-PLAN.md`（修改） | 更新 P2-16/17/18/19 状态和最近更新日期 | 状态仍为 `[-]`（实现中），未改为 `[x]` |
| `workbench/src/domain/update-check.ts`（新增） | 双通道更新域模型：退避、解码、门禁 | `nextRetryDelay` 含随机抖动；`canInstall` 仅检查 `compatibilityGate!=='blocked'`，`unknown` 允许安装但需用户确认 |
| `workbench/src/domain/entry-detect.ts`（新增） | 入口检测域模型：类型、标签、解码 | `decodeEntryList` 拒绝重复和超 20 项的列表 |
| `workbench/src/domain/resume-safety.ts`（新增） | 会话恢复安全域模型：警告派生 | `deriveResumeWarning` 输入校验 sessionId 长度和日期解析；`hasIncompleteTools` 当前保守为 false |
| `workbench/src/pages/SettingsPage.tsx`（重写） | 双通道更新 UI + 入口检测面板 | ChannelPanel/EntryPanel 使用 `setTimeout` 模拟异步，真实端点未接入；`aria-busy` 在检查/安装时设置 |
| `workbench/src/pages/LiveChatPage.tsx`（修改） | 查看历史正文时显示恢复警告 | `deriveResumeWarning` 使用 `new Date().toISOString()` 作为 lastActivity，实际接口未提供该字段 |
| `workbench/src/components/Panel.tsx`（修改） | 新增 `aria-busy` 属性支持 | `aria-busy={ariaBusy||undefined}` — false 时不设置属性 |
| `workbench/src/data/mockData.ts`（修改） | 新增 `updateCopy` 和 `liveCopy` 副作用警告文案 | 文案明确标注"不自动安装"、"不自动恢复或重放" |
| `workbench/tests/update-check.test.mjs`（新增） | 9 项测试覆盖三个新域模块 | 测试用合成对象，不连接真实服务 |
| `docs/p2/VALIDATION.md`（修改） | 记录 C 批测试结果 | 136 项（134 通过），2 项 Windows 预存失败未修复 |
| `docs/PROJECT-PLAN.md`（修改） | 更新 P2-15/09/12/13/05/08/11/14 状态 | 状态仍为 `[-]`（实现中），未改为 `[x]` |
| `workbench/src/domain/capability-storage.ts`（新增） | localStorage 持久化层：卡片草稿和证据记录的保存/加载/清空 | 仅持久化卡片定义和证据；不持久化执行输入、审批、令牌或会话内容；损坏负载返回空数组而非崩溃 |
| `workbench/tests/capability-storage.test.mjs`（新增） | 9 项测试覆盖持久化层往返、投影、限额、清空和不可用降级 | 测试用合成 localStorage backend，不依赖浏览器环境 |
| `workbench/tests/browser-rpc-fixture.js`（修改） | 扩展 fetch 拦截模拟能力目录和证据端点 | 夹具仅用于浏览器测试页面，不连接真实后端 |
| `workbench/tests/capability-integration.test.mjs`（新增） | 6 项跨模块集成测试覆盖完整执行链路 | 测试用合成对象和 Node crypto.subtle，不连接真实实例 |
| `docs/p2/VALIDATION.md`（修改） | 记录 D 批测试结果 | 151 项（149 通过），2 项 Windows 预存失败未修复 |
| `docs/PROJECT-PLAN.md`（修改） | 更新 P2-19 持久化状态和最近更新日期 | 状态仍为 `[-]`（实现中），未改为 `[x]` |

## 接口与安全决策

- 实际 Hermes 提交/契约及核对位置：开发基线 `28044757aabd34010bd9f5f3e3f82b0906b46241`（MODEL-HANDOFF §6）；本轮未连接真实实例，未核对新提交。
- 调用方法、输入输出、已知副作用：
  - `readInstanceCatalogCards`：GET `http://127.0.0.1:{port}/api/capabilities/catalog`，Bearer 认证，无 body，`credentials:'omit'`，`redirect:'error'`，`cache:'no-store'`。输出经 `importCapabilityDrafts` 强制草稿投影的 Capability 数组。无副作用。
  - `confirmExecution`：调用现有 `submitText`，发送 `prompt.submit` JSON-RPC（session_id + text）。不经 `command.dispatch`。一次确认至多发送一次；`prompt.submit` 失败（含超时）调用 `end()` 断开，不重发。
  - `readInstanceEvidence`：GET `http://127.0.0.1:{port}/api/capabilities/evidence`，Bearer 认证，无 body，`credentials:'omit'`，`redirect:'error'`，`cache:'no-store'`。输出经 `importVerificationDrafts` 强制 `trusted:false` 投影的 ImportedEvidence 数组。无副作用。
  - `environmentFingerprint`：从实例 Skill 目录的名称和指纹排序后 SHA-256 生成环境指纹。纯计算函数，无网络请求。
- 实例绑定、指纹变化、重复提交/断线策略：
  - 实例绑定：`historyAccess.current` 保存 port+token，`epoch.current` 代际守卫防止旧连接的迟到响应覆盖新状态。
  - 指纹变化：`verifyMethodFingerprint` 按方法名（非 card id）比对 expected 与 actual；mismatch/missing 时执行按钮禁用，显示具体原因。
  - 重复提交：`catalogBusy` ref 防并发目录读取；`confirmExecution` 检查 `exec.confirmed` 防重复确认；`submitText` 检查 `current.current?.status==='streaming'` 防重入。
  - 断线：`deriveExecutionPhase` 在 `disconnected && turn.status==='streaming'` 时返回 `unknown`，不视为取消或成功；`prompt.submit` 失败调 `end()` 断开，迟到响应不能完成新请求（RPC 层 epoch 守卫）。
  - 切换卡片/实例：`choose()` 调 `chat?.clearExecution()`；`loadInstanceCatalog` 成功后 `setExecution(null)`；`end()` 清空全部目录和执行状态。
- 新增持久化位置、字段、脱敏/迁移策略（没有则写无）：无新增持久化。执行状态仅保存在 React 内存中，刷新/断开清空。
- 是否改依赖、安装/更新/权限策略：未改依赖，未运行 npm install 升级，未修改 package-lock.json。`npm ci` 仅在缺 node_modules 时执行（安装已有锁文件依赖）。

## 验证证据

| 类型 | 实际命令/操作 | 结果/退出码 | 未覆盖范围 |
|---|---|---|---|
| 单元/构建 | `npm test`（workbench 目录） | 退出码 1：151 项，149 通过，2 项失败（`installer.test.mjs:40` Windows 文件 rename 行为差异，`skill-catalog.test.mjs:16` Windows 大小写不敏感导致 Case/case 不碰撞）——均为交接前预存的 Windows 特定失败，非本轮引入 | 真实模型、真实工具、Windows 进程树 |
| 单元/构建 | `npm run validate` | 退出码 0：16 个组件文件 AST 检查通过 | 窄屏、高 DPI、键盘、读屏 |
| 单元/构建 | `npm run build` | 退出码 0：TypeScript `tsc --noEmit` + Vite 生产构建成功，60 模块，dist 输出正常 | — |
| 单元/构建 | `node --test tests/capability-execution.test.mjs tests/capability.test.mjs` | 退出码 0：34 项全部通过（13 项执行逻辑 + 21 项能力/证据/环境指纹） | — |
| 单元/构建 | `node --test tests/update-check.test.mjs` | 退出码 0：9 项全部通过（退避、解码、门禁、入口、恢复警告） | — |
| 单元/构建 | `node --test tests/capability-storage.test.mjs` | 退出码 0：9 项全部通过（往返持久化、不可用降级、损坏负载安全、清空、限额拒绝） | — |
| 单元/构建 | `node --test tests/capability-integration.test.mjs` | 退出码 0：6 项全部通过（完整执行链路、指纹不匹配+环境变更、缺失技能、断流断连、指纹稳定性、失败证据） | — |
| 合成浏览器 | 未执行 | — | 合成 RPC 浏览器交互、卡片选择→参数→指纹→确认→发送→状态链路 |
| 隔离真实接口 | 未执行 | — | Linux bwrap 隔离探针、真实 control-server catalog 端点 |
| Windows/USB | 未执行 | — | Windows 实机进程树、U 盘便携发布 |

不得把合成输出称为真实业务验证；失败测试不能删除后宣称通过。

## 已知问题与复现

- 复现步骤、预期、实际：
  - `installer.test.mjs:40`：在 Windows 上运行 `npm test`，"mid-install rename failure restores earlier shell" 测试期望抛出 `/INSTALL_FAILED_ROLLED_BACK/`，实际未拒绝（Windows 文件 rename 行为与 Linux 不同）。交接前已存在。
  - `skill-catalog.test.mjs:16`：在 Windows 上运行 `npm test`，"catalog rejects links and case collisions" 测试期望抛出 `/COLLISION/`，实际未拒绝（Windows 默认大小写不敏感，`Case` 和 `case` 不碰撞）。交接前已存在。
- 仍运行的本批次服务及安全退出方式（无则写无）：无。本轮未启动任何服务或长运行进程。
- 未经实测的假设：
  - `readInstanceCatalogCards` 和 `readInstanceEvidence` 的绝对 URL 构造和 Bearer 认证仅经合成 mock fetch 测试，未在真实 control-server 上验证。
  - `confirmExecution` → `prompt.submit` → 模型回复 → `deriveExecutionPhase` 的端到端链路仅经单元测试验证逻辑推导，未连接真实 Hermes 验证。
  - `executionPhase` 和 `cardVerification` 的 UI 显示（`execCopy.phases[execPhase]` 和 `evCopy.statusUnknown` 查找）未在浏览器中验证。
  - `environmentFingerprint` 在浏览器 `crypto.subtle` 环境中的实际计算未在浏览器中验证（仅在 Node 22+ `globalThis.crypto.subtle` 中测试通过）。
  - C 批 `update-check.ts` 的双通道更新 UI 使用 `setTimeout` 模拟异步响应，未连接真实更新服务端点；`decodeUpdateCheck`/`deriveUpdateOutcome` 仅经合成对象测试。
  - C 批 `entry-detect.ts` 的 EntryPanel 模拟返回空列表，真实入口检测端点未接入；`decodeEntryStatus`/`decodeEntryList` 仅经合成对象测试。
  - C 批 `resume-safety.ts` 的 `deriveResumeWarning` 使用 `new Date().toISOString()` 作为 lastActivity（实际接口未提供该字段），`hasIncompleteTools` 保守为 false；真实恢复语义需核对上游 `session.resume` 接口。
  - C 批 `Panel.tsx` 的 `aria-busy` 属性在真实浏览器中的辅助技术行为未验证。
  - D 批 `capability-storage.ts` 的 localStorage 持久化在真实浏览器中的行为未验证（仅在 Node 合成 backend 中测试）；浏览器隐私模式或配额超限时的降级行为未测试。
  - D 批 `browser-rpc-fixture.js` 的 fetch 拦截扩展仅在夹具代码层面完成，未在真实浏览器测试页面中执行端到端验证。
  - D 批 `capability-integration.test.mjs` 的跨模块测试使用 Node `crypto.subtle`（Node 22+），浏览器 `crypto.subtle` 的兼容性未在浏览器中验证。
- 需要 Codex 优先审查的文件/问题：
  - `capability-execution.ts`：`deriveExecutionPhase` 的 `match`→`verified` 映射和 `disconnected && streaming`→`unknown` 逻辑。
  - `capability.ts`：`environmentFingerprint` 的排序+哈希算法是否满足环境变更检测需求；`importVerificationDrafts` 的 `trusted:false` 投影是否覆盖所有外部输入路径。
  - `useLiveChat.ts`：`confirmExecution` 的 `preserveExecution` 标志和 `submitText` 的交互；`loadInstanceEvidence` 的 epoch 守卫和 `evidenceBusy` 防并发；`loadInstanceCatalog` 成功后计算环境指纹的 async 交互。
  - `CapabilitiesPage.tsx`：`canExecute` 条件链和 `execForCard` 匹配逻辑；证据面板和验证状态的条件渲染。
  - C 批 `update-check.ts`：`canInstall` 允许 `compatibilityGate:'unknown'` 安装（需用户确认），仅 `blocked` 阻止；`nextRetryDelay` 的随机抖动范围（0–5s）是否合适。
  - C 批 `entry-detect.ts`：`decodeEntryList` 的 20 项上限是否合理；`decodeEntryStatus` 的 `note` 字段 256 字符上限。
  - C 批 `resume-safety.ts`：`deriveResumeWarning` 的输入校验（sessionId 256 字符上限、日期解析）和 `hasIncompleteTools` 保守 false 的策略。
  - C 批 `SettingsPage.tsx`：ChannelPanel/EntryPanel 的 `setTimeout` 模拟流程和 `aria-busy` 设置；`updateCopy` 的文案是否覆盖所有状态。
  - C 批 `LiveChatPage.tsx`：`deriveResumeWarning` 在查看历史正文时的条件渲染和 `new Date().toISOString()` 作为 lastActivity 的合理性。
  - D 批 `capability-storage.ts`：版本化存储键策略（`-v1` 后缀，拒绝旧版本而非迁移）；损坏负载返回空数组而非抛异常的安全降级策略；65KB/128KB/500 条限额是否合理。
  - D 批 `browser-rpc-fixture.js`：fetch 拦截的 URL 匹配逻辑（`includes` 而非严格相等）是否过于宽松；fixture 卡片和证据数据的指纹是否与测试预期一致。
  - D 批 `capability-integration.test.mjs`：跨模块测试的组合是否覆盖了关键边界；`execJs` 的 import type 剥离是否稳定（依赖正则匹配）。

## 回交完整性

- 同工作区 / 独立副本 / 补丁及新增文件包：同工作区（`C:\Users\zhang_gujing\Desktop\Hermes-USB-Portable`），全部改动保留在本地工作树。
- 新增文件是否完整包含：是。A 批 `workbench/src/domain/capability-execution.ts` 和 `workbench/tests/capability-execution.test.mjs`；B 批无新增文件（扩展既有文件）；C 批 `workbench/src/domain/update-check.ts`、`workbench/src/domain/entry-detect.ts`、`workbench/src/domain/resume-safety.ts` 和 `workbench/tests/update-check.test.mjs`；D 批 `workbench/src/domain/capability-storage.ts`、`workbench/tests/capability-storage.test.mjs` 和 `workbench/tests/capability-integration.test.mjs` 均已在工作区创建，`git status --short` 显示为未跟踪（`??`）。
- 是否含个人数据、凭据或生成缓存：否。无 `.env`、令牌、个人聊天正文、密钥或 node_modules。
- 是否 commit/push/发布；如有，用户授权与标识：未 commit、未 push、未发布。用户仅授权了交接提交 `aecd17d`，本轮改动未提交。
- 下一步建议（不自行宣告发布或验收通过）：
  - Codex 审查 A+B+C+D 批代码后，建议执行合成 RPC 浏览器测试（卡片选择→参数填写→指纹核对→确认→发送→阶段状态→证据读取→验证状态→返回审批）。D 批已扩展 `browser-rpc-fixture.js` 覆盖 catalog 和 evidence 端点，可直接用于浏览器测试。
  - 在 Linux bwrap 隔离环境验证 `readInstanceCatalogCards` 和 `readInstanceEvidence` 对真实 control-server 端点的调用。
  - 后端需实现 `/api/capabilities/evidence` 端点（GET，Bearer 认证，返回 `VerificationEvidence[]` 格式的 JSON 数组）。
  - C 批后端需实现更新检查和入口检测端点（GET，Bearer 认证），客户端 `decodeUpdateCheck`/`decodeEntryStatus` 已就绪。
  - C 批需核对上游 `session.resume` 接口的恢复语义，确认 `hasIncompleteTools` 的获取方式。
  - C 批需在真实浏览器中验证 `aria-busy` 的辅助技术行为和窄屏/高 DPI 布局。
  - D 批需在真实浏览器中验证 localStorage 持久化的实际行为（隐私模式降级、配额超限处理）；将持久化层接入 `CapabilitiesPage` 的 `useEffect` 初始化和 `saveDrafts`/`saveEvidence` 调用。
  - 2 项 Windows 预存失败需在 Linux 上复跑确认是否为平台差异，或在 Windows 上修正测试预期。
  - `release_ready` 保持 `false`；不可因本轮测试通过而解除发布门禁。
