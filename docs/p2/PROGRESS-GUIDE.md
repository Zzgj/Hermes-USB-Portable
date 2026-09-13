# P2 阶段开发进度与内容指南

> 本文档汇总 A/B/C/D 四批开发任务的进度、交付内容、安全约束和审核要点，供 Codex 审查时快速定位代码和设计决策。

## 1. 基线信息

| 项目 | 值 |
|---|---|
| 接手 Git HEAD | `aecd17d`（`chore: checkpoint P2 development for model handoff`） |
| 分支 | `feat/portable-initializer` |
| 接手日期 | 2026-09-13 |
| 工作机 | Windows（当前开发机） |
| 接手时测试基线 | 102 项测试，16 个组件 |
| 当前测试状态 | 151 项测试（149 通过，2 项 Windows 预存失败） |
| `release_ready` | `false`（未变更） |

## 2. 任务批次总览

| 批次 | 覆盖 P2 任务 | 交付性质 | 状态 |
|---|---|---|---|
| A 批 | P2-16/17 | 真实能力卡片最小闭环（指纹重核→确认→prompt.submit） | 域逻辑+UI+测试已实现 |
| B 批 | P2-18/19 | 验证证据与学习产出关联 | 域逻辑+UI+测试已实现 |
| C 批 | P2-15/09/12/13/05/08/11/14 | 双通道更新/入口检测/恢复安全/无障碍/打包验证 | 域逻辑+UI+测试已实现 |
| D 批 | P2-19 相关 | localStorage 持久化层/合成测试夹具扩展/跨模块集成测试 | 域逻辑+测试已实现 |

> 所有 P2 任务在 `PROJECT-PLAN.md` 中仍标记为 `[-]`（实现中），未升级为 `[x]`（已完成并有可核对证据）。

## 3. 各批次交付详情

### A 批：真实能力卡片最小闭环（P2-16/17）

**目标**：实现从能力卡片选择到 Hermes 执行的最小闭环，使用 `prompt.submit` 而非 `command.dispatch`。

**新增文件**：
- `workbench/src/domain/capability-execution.ts` — 指纹重核、提示构造、执行阶段推导
- `workbench/tests/capability-execution.test.mjs` — 13 项测试

**修改文件**：
- `workbench/src/domain/capability.ts` — 新增 `readInstanceCatalogCards`
- `workbench/src/hooks/useLiveChat.ts` — 新增 `loadInstanceCatalog`/`prepareExecution`/`confirmExecution`/`clearExecution`/`executionPhase`
- `workbench/src/pages/CapabilitiesPage.tsx` — 重写为执行闭环 UI
- `workbench/src/data/mockData.ts` — 新增 `executionCopy`
- `workbench/src/App.tsx` — 向 CapabilitiesPage 传入 chat prop
- `workbench/tests/capability.test.mjs` — 扩展 4 项测试

**关键设计决策**：
- 执行通过 `prompt.submit` 发送自然语言提示，不使用 `command.dispatch`
- 指纹核对按方法名比对，结果为 match/mismatch/missing
- 执行阶段：idle/verified/mismatch/missing/observing/complete/failed/interrupted/unknown
- 断流期间 streaming 状态推导为 unknown（不允许迟到的响应完成另一个请求）
- `preserveExecution` 避免发送 prompt.submit 时清空执行状态

### B 批：验证证据与学习产出关联（P2-18/19）

**目标**：实现验证证据的读取、导入和卡片验证状态派生；环境指纹检测方法/环境变更。

**修改文件**：
- `workbench/src/domain/capability.ts` — 新增 `ImportedEvidence` 接口、`importVerificationDrafts`、`readInstanceEvidence`、`environmentFingerprint`
- `workbench/src/hooks/useLiveChat.ts` — 新增 `loadInstanceEvidence`、`cardVerification`、evidence 状态管理
- `workbench/src/pages/CapabilitiesPage.tsx` — 新增验证证据面板和学习产出关联提示
- `workbench/src/data/mockData.ts` — 新增 `evidenceCopy`
- `workbench/tests/capability.test.mjs` — 扩展 8 项测试

**关键设计决策**：
- 外部导入的证据一律 `trusted:false`，不接受外部声明的 trust 字段
- 环境指纹 = SHA-256(sorted `skillName:fingerprint` pairs)，方法或环境变更触发 `reverify`
- `readInstanceEvidence` 统一抛 `EVIDENCE_FAILED`，不泄露原始错误
- 证据读取限额 140 KiB，导入限额 128 KiB / 500 条

### C 批：配置/更新/恢复安全/无障碍/打包收尾（P2-15/09/12/13/05/08/11/14）

**目标**：实现双通道更新 UI、入口检测、会话恢复安全检查、Profile/Skill 副作用警告、无障碍改进和打包策略验证。

**新增文件**：
- `workbench/src/domain/update-check.ts` — 双通道更新模型（指数退避、兼容性门禁）
- `workbench/src/domain/entry-detect.ts` — 入口检测模型（CLI/TUI/Desktop/Web）
- `workbench/src/domain/resume-safety.ts` — 会话恢复安全检查
- `workbench/tests/update-check.test.mjs` — 9 项测试

**修改文件**：
- `workbench/src/pages/SettingsPage.tsx` — 重写为双通道更新 UI + 入口检测面板
- `workbench/src/pages/LiveChatPage.tsx` — 新增恢复安全警告 + Profile/Skill 副作用警告
- `workbench/src/components/Panel.tsx` — 新增 `aria-busy` 支持
- `workbench/src/data/mockData.ts` — 新增 `updateCopy`、`liveCopy` 扩展

**关键设计决策**：
- 双通道：内核（官方 `hermes update`）和外壳（独立包）独立检查/计划/安装
- 指数退避 60s–3600s + 随机抖动，离线/失败不反复请求网络
- 兼容性门禁 blocked 时禁止安装
- 会话恢复可能继续未完成的工具执行，必须明确确认；不自动恢复或重放
- Profile/Skill 面板展示接口副作用警告（只读枚举，不造平行配置体系）
- 打包策略验证：新增前端源码均由 Vite 打包到 `dist/`，已被 `workbench/dist/**` 覆盖

### D 批：localStorage 持久化/合成测试夹具/跨模块集成测试

**目标**：实现卡片草稿和证据的浏览器持久化；扩展合成浏览器测试夹具覆盖能力卡片执行链路；补充跨模块集成测试。

**新增文件**：
- `workbench/src/domain/capability-storage.ts` — localStorage 持久化层
- `workbench/tests/capability-storage.test.mjs` — 9 项测试
- `workbench/tests/capability-integration.test.mjs` — 6 项跨模块集成测试

**修改文件**：
- `workbench/tests/browser-rpc-fixture.js` — 新增 fetch 拦截模拟 catalog/evidence 端点

**关键设计决策**：
- 仅持久化卡片定义（投影为 draft 状态）和证据记录（强制 `trusted:false`）
- 不持久化执行输入、审批、令牌或会话内容
- 版本化存储键（`-v1` 后缀）防止 schema 漂移——旧版本负载被拒绝而非迁移
- 损坏负载返回空数组而非抛异常
- 限额：卡片 65KB，证据 128KB / 500 条

## 4. 全部变更文件清单

### 新增文件（10 个）

| 文件路径 | 说明 | 批次 |
|---|---|---|
| `workbench/src/domain/capability-execution.ts` | 指纹重核/提示构造/执行阶段推导 | A |
| `workbench/src/domain/capability-storage.ts` | localStorage 持久化层 | D |
| `workbench/src/domain/entry-detect.ts` | 入口检测域模块 | C |
| `workbench/src/domain/resume-safety.ts` | 会话恢复安全检查 | C |
| `workbench/src/domain/update-check.ts` | 双通道更新域模块 | C |
| `workbench/tests/capability-execution.test.mjs` | 13 项执行逻辑测试 | A |
| `workbench/tests/capability-integration.test.mjs` | 6 项跨模块集成测试 | D |
| `workbench/tests/capability-storage.test.mjs` | 9 项持久化层测试 | D |
| `workbench/tests/update-check.test.mjs` | 9 项更新/入口/恢复测试 | C |
| `docs/p2/RETURN-REPORT.md` | 回交报告 | 全部 |

### 修改文件（11 个）

| 文件路径 | 说明 | 批次 |
|---|---|---|
| `workbench/src/domain/capability.ts` | 新增 readInstanceCatalogCards/importVerificationDrafts/readInstanceEvidence/environmentFingerprint | A+B |
| `workbench/src/hooks/useLiveChat.ts` | 新增目录读取/执行/证据/验证状态管理 | A+B |
| `workbench/src/pages/CapabilitiesPage.tsx` | 重写为执行闭环 UI + 证据面板 | A+B |
| `workbench/src/pages/SettingsPage.tsx` | 重写为双通道更新 UI + 入口检测 | C |
| `workbench/src/pages/LiveChatPage.tsx` | 新增恢复安全警告 + 副作用警告 | C |
| `workbench/src/components/Panel.tsx` | 新增 aria-busy 支持 | C |
| `workbench/src/data/mockData.ts` | 新增 executionCopy/evidenceCopy/updateCopy/liveCopy 扩展 | A+B+C |
| `workbench/src/App.tsx` | 向 CapabilitiesPage 传入 chat prop | A |
| `workbench/tests/capability.test.mjs` | 扩展 12 项测试 | A+B |
| `workbench/tests/browser-rpc-fixture.js` | 新增 fetch 拦截 | D |
| `docs/PROJECT-PLAN.md` | 更新 P2 任务状态 | 全部 |

## 5. 安全约束遵循情况

| 约束 | 遵循情况 |
|---|---|
| 只读请求不使用 command.dispatch | ✅ 全部通过 prompt.submit 发送自然语言提示 |
| 不自动发送/审批/发布 | ✅ confirmExecution 需要手动确认复选框 + 按钮点击 |
| 断流/迟到/重复安全 | ✅ epoch 守卫、catalogBusy/evidenceBusy 防并发、AbortController 可取消、断流 streaming→unknown |
| 不修改个人配置 | ✅ 未修改 .claude/settings.json 或 .trae/rules |
| 同步打包白名单 | ✅ 新增文件均由 Vite 打包到 dist/，已被 workbench/dist/** 覆盖 |
| release_ready 保持 false | ✅ 未变更 |
| 外部证据强制 trusted:false | ✅ importVerificationDrafts 和 saveEvidence 均强制投影 |
| 不泄露原始错误 | ✅ readInstanceEvidence 统一抛 EVIDENCE_FAILED |

## 6. 测试结果

| 测试范围 | 总数 | 通过 | 失败 | 说明 |
|---|---|---|---|---|
| `npm test`（全量） | 151 | 149 | 2 | 2 项为 Windows 预存失败（installer.test.mjs:40 文件 rename、skill-catalog.test.mjs:16 大小写不敏感） |
| `capability-execution.test.mjs` | 13 | 13 | 0 | — |
| `capability.test.mjs`（扩展部分） | 12 | 12 | 0 | — |
| `update-check.test.mjs` | 9 | 9 | 0 | — |
| `capability-storage.test.mjs` | 9 | 9 | 0 | — |
| `capability-integration.test.mjs` | 6 | 6 | 0 | — |
| `npm run validate` | 16 | 16 | 0 | AST 结构检查 |
| `npm run build` | 60 模块 | — | 0 | dist 输出正常 |

## 7. 未完成项与外部阻塞

### 被真实 Hermes 实例阻塞
- P2-03/05/06/07/08/13/16/17/18/19 的真实模型/工具/审批/恢复/执行链路验证
- `/api/capabilities/evidence` 后端端点未实现
- `/api/sessions/{id}/messages` 后端端点未实现
- `/api/ws` WebSocket 后端端点未实现

### 被 Windows 实机阻塞
- P2-04 Windows 进程树与重连

### 被 .stitch 设计文件阻塞
- P2-01 视觉校准（仓库中不存在 .stitch 文件）

### 被上游源码授权阻塞
- P2-12 完整字段/敏感信息审计

### 需要前置门禁全通过
- P2-14 集中测试包

### 需要真实浏览器+辅助技术
- P2-11 完整键盘/读屏/高 DPI 矩阵验证
- D 批 localStorage 持久化的真实浏览器行为验证

## 8. Codex 审查要点

以下是需要重点审查的设计决策和代码位置：

1. **A 批 `capability-execution.ts`**：`deriveExecutionPhase` 的 match→verified 映射是否正确；断流 streaming→unknown 是否覆盖所有边界
2. **A 批 `useLiveChat.ts`**：`confirmExecution` 的发送条件（match + 已确认 + 非 streaming）是否充分；`preserveExecution` 是否避免发送时清空
3. **B 批 `capability.ts`**：`importVerificationDrafts` 强制 trusted:false 的投影逻辑；`environmentFingerprint` 的排序和 SHA-256 计算是否正确
4. **C 批 `SettingsPage.tsx`**：ChannelPanel 的 check→plan→install 流程是否安全（不自动安装、需确认）；`updateCopy` 文案是否完整
5. **C 批 `resume-safety.ts`**：`deriveResumeWarning` 的 `hasIncompleteTools` 保守 false 是否合理
6. **D 批 `capability-storage.ts`**：版本化存储键策略；损坏负载安全降级；限额是否合理
7. **D 批 `browser-rpc-fixture.js`**：fetch 拦截的 URL 匹配逻辑是否过于宽松
8. **D 批 `capability-integration.test.mjs`**：跨模块测试的组合是否覆盖关键边界

## 9. 文档索引

| 文档 | 说明 |
|---|---|
| [MODEL-HANDOFF.md](MODEL-HANDOFF.md) | 接力交接文档，含 A/B/C 批开发计划 |
| [RETURN-REPORT.md](RETURN-REPORT.md) | 回交报告，含完成项/未完成项/验证证据/审查项 |
| [VALIDATION.md](VALIDATION.md) | 测试与验证结果记录 |
| [PROJECT-PLAN.md](../PROJECT-PLAN.md) | 项目计划，含 P2 全部任务状态 |
| [PROGRESS-GUIDE.md](PROGRESS-GUIDE.md) | 本文档 |
