# P2 单分支交接与剩余审查

## 最新员工任务：P2-09-NATIVE-PACKAGE-03

### 执行主体与额度安排

- **开发 Agent 主体：@usb-project-employee**；本批唯一代码写入者，分支 dev/company。
- **独立复验主体：@code-reviewer**；组织测试及返工，不默认接管写入。
- **架构/范围与阶段决策主体：@usb-project-lead**；本批仅派单、审查证据，不重复员工开发或组长全量复验。
- 按用户新的额度安排，后续每份任务单均明确开发 Agent 主体、审查主体、允许文件、基线和验证范围；常规执行优先交 employee。模型名称/版本由执行实例实际核对回报，不根据换模推断能力或扩大权限。核心机制与安全接口仍由 lead 锁定，任何超范围修改先升级确认。

用户要求下发下一批。employee 在 dev/company 从固定 base `9e5c0df9b920f40b79691bd2173a78c43e39d98a` 开始；lead 已实际 fetch 并读取 R1 差异，功能性返工点已对齐，27 项通过是 reviewer 执行证据而非 lead 重跑。R1 面板 failed 用例中“Open is visually available”注释与 disabled 实现不符，为非阻塞说明问题，本批不借机改生产。下方 COVERAGE-02/R1 作为历史，当前不再重复实现页面。

### 目标与允许文件

验证原生入口生产模块在 P2 增量包中的完整性，以及该增量包依赖匹配 P0 启动器的事实，避免“包白名单有名字”被误报成“安装后可启动”。只开发自动测试和指引，不做真实打包发布/安装。允许新增 `workbench/tests/native-package-contract.test.mjs`，修改 `docs/p2/ACCEPTANCE.md`；禁止修改所有生产 scripts/src、包白名单、guard JSON、启动器、依赖、其他测试与进度文件。

### 一个工作包的三个子任务

1. **T1 实际源码的 staging 契约**：使用现有 `stageP2Package`，从固定源码工作区只复制 packageFiles 白名单中的真实文件到本批临时 repo；仅 dist/index.html 及一个 dist/assets 合成文件可用明确标注的 fixture，不构建/运行业务。断言输出逐文件字节/大小/SHA-256 与输入一致；native host、协议、adapter、manager、legacy/guard JSON 等完整存在；manifest 无重复、release_ready=false。不能把所有源码写成字符串 fixture 冒充生产内容验证。
2. **T2 分包与一致性失败路径**：动态导入 staging 输出的真实 `portable-entry-guard.mjs`，以本批临时目标 root/data 调用；从固定基线复制匹配的 launch.bat/open-hermes.ps1/start-web-workbench.ps1 到临时目标（不执行）以证明匹配组合通过。对仅有 P2 输出而缺 P0 启动器、旧/篡改启动器、缺失 legacy 协调文件、恢复标记和 gateway.pid 分别断言拒绝；验证 marker 原文保留、未自动创建/清除实例锁。检查 launch.bat 等 P0 文件不在增量包内，不能通过修改白名单/guard 哈希让失败变绿。测试不生成真实进程，不启动监听，不调用安装器。LF/CRLF 等价以临时文件覆盖；平台不能创建链接时明确跳过相关额外场景，不调整系统权限。
3. **T3 操作前提与证据层级**：在 ACCEPTANCE 补充增量包≠完整启动外壳、需要匹配 P0 文件、失败时不清锁/不自动修复/不安装的指引，逐项关联 T1/T2。修正旧矩阵中已改名的 R1 用例引用，并明确 failed/unknown 仍可经确认显式停止。没有 Windows 运行、模型或浏览器证据的项继续未勾选，不声明已生成可部署包。

### 验证、协作与回交

- 只使用已存在 Node 与标准库；在工作区或独立受控副本 `workbench` 执行 `node --test tests/native-package-contract.test.mjs tests/package.test.mjs tests/portable-native-entries.test.mjs`。这批无 npm ci/install、无构建、无浏览器、不需借用 node_modules；缺 Node 即报告，不安装。
- 所有 fixture 在本批自有临时根；仅从源码白名单读入，禁止读真实 data/Runtime/个人配置。注册清理，失败保留必要证据，不删除未知目录。敏感性验证只能内存或独立临时副本。已有实现满足测试则记补充覆盖，不制造虚假红灯。
- 核心生产问题由 lead 修复；遇到接口变化、缺依赖或真实环境操作需要立即报告，不以补测试为名扩大范围。同一根因最多三轮。reviewer 组织返工，employee 回交固定 commit 后暂停，reviewer 在独立副本实际运行同一定向命令，不并发写同一目录。
- employee → reviewer → lead 回交完整 base/result、两文件清单、实际命令/退出码、逐用例断言与失败/跳过、临时根清理结果、存储/隐私影响。通过后 employee 正常推送 dev/company 并远端回读；不得改 dev/lead 或正式集成。lead 不同时编辑员工这两文件。浏览器 setup 诊断、原生 Windows 监督/交互与核心审查问题仍是独立门禁，本任务不替代这些工作。

## 当前派单：NATIVE-01 固定源码审查与补充测试开发

本节取代下方历史“当前派单”。用户已要求推送源码并同步下发 reviewer 审核与 employee 开发任务；不增加第四个审查分支，沿用 dev/lead、dev/company、feat/portable-initializer。正式集成不推进。

### 固定代码与获取

- 审查 base：`d8f64a8fe831d4db277c221c9bcf47d87be2b882`；源码 result：`41387cdbbea4250482db97d094cd4b2602c8ebef`，在 dev/lead 发布。此后任务单提交仅文档，不改变该源码身份。
- result 包含 19 个修改、25 个新增文件；全部 44 个 Git blob 已与此前交付归档逐字节核对一致。完整清单使用 `git diff --name-status d8f64a8fe831d4db277c221c9bcf47d87be2b882 41387cdbbea4250482db97d094cd4b2602c8ebef`，不要只审 tracked WIP 或移动分支尖端。
- 实际证据：Node 全量 417 通过、零失败/跳过；Python 仅 native host 定向 3 通过、2 个 Windows 用例跳过；validate 18 组件和构建通过。三个浏览器脚本均在准备阶段失败，尚无页面业务断言通过。开发检查点不是已验版本，旧浏览器通过不覆盖本次。
- 先核对本机 repo/remote/HEAD/工作区，保护未提交内容，再 `git fetch origin dev/lead`，确认上述完整 SHA 可读取。reviewer 用单独 detached worktree，只读审查 result。不要覆盖 employee 正在写入的目录，也不将本机路径当成跨电脑传输。

### Reviewer：P2-09-NATIVE-01-STATIC-REVIEW

目标是固定 base..result 的独立静态审查，不要求等待浏览器问题修复。范围覆盖上述 44 文件及其直接调用者：监督协议/Windows Job 归属、共享锁、legacy 入口、管理 API、生产组装/打包、客户端及页面。

1. 核查创建时 Job 归属和继承句柄；普通 host exit 不可代替整树证明；错误、协议截断、流异常及超时保留 unknown/锁。CLI 控制台与 Dashboard 健康检查证据分开。
2. 核查旧 launch/Gateway/config/doctor/更新路径有无绕过，版本 guard 与 P0/P2 分包是否导致不可达或不一致；固定 Hermes 版本和资产缺失不能隐式安装/构建。
3. 核查认证/Origin/无正文接口、管理与 native 互斥、停止重试、错误投影；客户端身份代际、卸载、迟到响应、accepted 后重核、风险确认及无自动重启。
4. 区分生产缺陷、测试夹具缺陷、覆盖缺口和环境待验；浏览器 setup 失败不能被泛化为页面通过或已证实业务故障。

本任务只读，不修改源码、不运行浏览器/真实实例/模型；如需执行新增验证先报范围。回交 result SHA、所审路径、按严重度排序的问题、文件行号、触发前提/证据、建议及未测项。静态结论只能写“静态审查通过/需返工”，不能冒充测试验收；此任务不授予 reviewer 写 dev/company 权限。

### Employee：P2-09-NATIVE-COVERAGE-02（一个工作包）

页面最小实现已由 lead 补齐，不重复按钮开发。本批独立开发补充回归测试及验收指引，不依赖 reviewer 静态审查完成，不改核心接口或实现。

- 源码开发基线锁定 `41387cdbbea4250482db97d094cd4b2602c8ebef`。lead 核对远端 dev/company 为 `5b6c9ed56e250dc5411a84210bc5d88c47d47fab`，且为源码 result 的祖先；employee 须本机重核。工作区干净且祖先关系仍成立时，在独立开发工作区的 dev/company 执行 `git merge --ff-only 41387cdbbea4250482db97d094cd4b2602c8ebef`；若有额外提交、分叉或脏文件，停止回报，不 reset/rebase/强推。只推 dev/company，不改 dev/lead。
- 允许文件仅：`workbench/tests/native-entry-client.test.mjs`、`workbench/tests/native-entry-panel.test.mjs`、`docs/p2/ACCEPTANCE.md`。本任务执行期间 lead 不并发编辑这三文件。不得修改 src/scripts、原生 host、锁、服务接口、package.json、依赖或浏览器脚本；发现生产缺陷提交最小复现，由 lead 修复。
- **T1 请求/状态回归**：使用现有 TypeScript 转译与 node:test 导入真实 domain/hook，补齐正文悬挂时取消、分块累计超限、非法 UTF-8/截断 JSON、403/409/500 不泄露响应正文；显式状态读取在动作应答后失败必须 unknown；同身份旧回调、身份往返及卸载后旧响应不可覆盖新状态或启动请求。按明确屏障控制异步，不用固定 sleep 猜顺序；计数断言零越权动作/无自动重试。
- **T2 展示交互回归**：在实际 NativeEntryPanel 的事件回调层检验未确认无动作、确认后仅一次、动作消耗确认、刷新清除确认、pending/未认证/failed 隐藏旧成功并限制动作、CLI 不能打开 Dashboard。可用合成 React hook/JSX 调度器，不复制生产判断；明确这种测试不是浏览器点击或 Windows 验收。不修改组件以迎合测试；必要的跨身份重挂由 SettingsPage key 负责，独立面板测试不能冒充已覆盖。
- **T3 验收指引**：只在 ACCEPTANCE 新增 NATIVE-01 场景矩阵/操作说明，列设置页认证→显式状态读取→风险确认→启动→再次读取→Dashboard 打开→明确停止；注明 CLI 进程创建不等于交互可用、同 home 互斥、外部旧入口拒绝、未知状态不清锁、P0 启动器匹配前提。区分自动合成证据、待 Windows 实机和待模型验证，保留历史记录，不填虚构通过。
- 冻结测试契约：`requestNativeEntry(identity,action,signal)` 仅 status/cli/dashboard/stop/open；status 为 `{kind:null|cli|dashboard,state:idle|starting|running|stopping|unknown}`；hook 返回 status/pending/failed/canInspect/refresh/act。组件 props 以固定 result 的 readonly NativeEntryPanelProps 为准，不接收令牌或 URL。对现有实现满足的场景如实记覆盖补充，不能制造虚假先红。
- 允许的开发/组长复验：在各自独立 workbench，使用已安装依赖执行 `node --test tests/native-entry-client.test.mjs tests/native-entry-panel.test.mjs tests/merge-handoff.test.mjs`、`npm run validate`、`npm run build`。无浏览器、无真实锁/进程/模型/实例；无安装。reviewer 静态审核与 employee 编码可以分目录并行，employee 回交后暂停，reviewer 再对固定公司 result 实际执行这些命令。
- 同一失败最多三轮；清理异常、缺依赖、需改生产/接口立即停止受影响路径。employee 先向 reviewer 交固定 base/result、三文件完整差异、用例敏感性证据、命令/退出码、失败/未测范围和清理情况；reviewer 实测后给通过/需返工/待环境验证及残余风险，再向 lead 汇总。两者使用同机固定提交复验即可，按三分支授权由 employee 发布经复验的 dev/company，禁止并发写同一目录。未审通过允许明确标注失败的开发检查点，不合入正式集成。

## 当前三分支交接（取代下方历史单分支派单）

用户已批准以 `6e2f64ae947117f6ccbf1efda1b55cb0e2394e4f` 为共同基线：lead 创建并发布 `dev/lead` 的能力 API/面板接线工作；employee 创建 `dev/company` 并保存 CLI-BASELINE-03 三文件返工，保留退出码失败用例；reviewer 读取两分支的固定提交复审并向 lead 汇总。正式集成分支 `feat/portable-initializer` 暂不推进，Windows 退出码缺陷未关闭，不将开发检查点当作发布。

lead 本次保护并逐字节保留 15 个原 WIP 文件后创建分支。本次为源码传输与规则更新，没有重新运行应用测试/构建；此前 360 项和浏览器证据是历史验证，reviewer 应审查最终发布 SHA。提交后两侧分别回交 branch/base/result、文件清单、失败/未测范围及远端回读。授权与组织细则以 AI_GUIDE 顶部为准。

## 当前派单：P2-CLI-BASELINE-03（一个工作包、三个子任务）

- 用户补充：lead 可直接向 employee 下发原始任务并同步 reviewer；日常进度/返工仍 employee → reviewer → lead。本工作包集中交付，不逐补丁反复派单。基线 `6e2f64ae947117f6ccbf1efda1b55cb0e2394e4f`，分支 `feat/portable-initializer`；公司可立即基于已有基线执行，不依赖负责人尚未发布的 API/页面接线代码。
- 唯一实现者 employee；reviewer 组织测试及返工后汇总。公司共享目录不得并发编辑/构建。允许文件仅：新增 `workbench/tests/entry-lock-concurrency.test.mjs`；修改 `workbench/tests/test_windows_job_host.py`；在 `docs/p2/ACCEPTANCE.md` 新增本工作包的开发侧验收矩阵（保留旧证据）。不改 package.json、任何生产 scripts/src、现有面板测试、其他文档或配置。
- **T1 同 home 锁并发与隔离测试**：调用生产 acquireInstanceLock，使用本批临时 home 与已有 Node，自有子进程以 IPC/管道屏障同时争抢。两个独立进程同 home 恰一成功、另一个 INSTANCE_LOCKED，失败者不改 owner；持有者显式释放后可重取；不同 home 可同时持锁；owner 被替换后释放拒绝且替换内容保留。不得复制锁实现、只用固定 sleep 同步、以 PID 失活回收，不能扫描或清理真实锁。测试退出前回收本批子进程，再清理本批临时根。
- **T2 Windows Job Host 隔离补证**：扩充现有 unittest，保留 host 终止及管道 EOF 两个用例；增加直接子正常退出而孙进程仍在时的清理和退出码传播、关闭 A 不影响独立自有 B、containment 拒绝时不产生业务子进程。使用已有可确认的 Python 标准库和合成 sleeper；真实 Windows handles 判定进程结束，超时不能算通过。mock 的失败注入与真实 Job 测试分层报告；不安装 Python、不借用 E 盘 data/真实 Hermes、不读取配置。只终止本批创建且持有句柄的测试进程，无法确认清理则阻塞，不全局 taskkill。无原生 Windows/Python 环境则明确阻塞/跳过，不改 Linux skip 为通过。
- T2 的生产局限必须保留：windows-job-host.py:82 的子 stdin 为 DEVNULL，owned-process 是无头健康探测服务监督，均不能据此宣布交互式 CLI 完成；测试不能伪造终端输入支持，也不由员工改宿主代码绕过。核心接口和交互终端方案由 lead 负责。
- **T3 验收矩阵**：逐项记录 T1/T2 的测试名、源码调用位置、合成或真实 Windows 层级、实际命令/退出码/证据与未测项；另列 CLI 后续门禁：终端交互输入、同 home 模式切换、旧 launch/Gateway 路径协调、身份不明拒绝启动、断线未知、不自动重试、正常退出完整进程树回收。已通过的旧模型/历史正文反馈不重复派给用户；不得把开发侧测试写成 E 盘验收。
- 顺序：先保护现场并核对基线/已有测试 → 写可暴露问题的测试 → T1/T2 独立完成 → 汇总 T3 → employee 暂停 → reviewer 在同一受控快照复验。既有实现已满足新增测试时如实写覆盖补充；导入错误不是行为红灯。若暴露生产缺陷，员工交最小复现给组长，组长上报 lead，禁止越界修复或删除断言。
- 验证范围：公司在 workbench 运行 `node --test tests/entry-lock-concurrency.test.mjs tests/instance-lock-recovery.test.mjs`、用已核实 Python 执行 `tests/test_windows_job_host.py`，随后 `npm test`、`npm run validate`、`npm run build`；每项命令独立记录退出码，Python 路径不猜测。reviewer 每批必须实际验证，缺环境则待环境验证；lead 本轮只读检查和派单，不执行测试，阶段复验另报总监决定。
- 统一回交：完整基线/结果身份、三文件清单、测试证据、失败/跳过/未测矩阵、接口/存储/隐私影响、清理结果及建议；结果未提交就明确说明，无提交 SHA 不造数。每个失败路径最多三轮，不能无限试验。提交推送/真实实例部署须另获批准；负责人当前未发布代码的独立复审继续等待传输授权，不把本任务当该批复审。

## 最新交接（2026-10-14）

公司 VIEW-02 的两文件提交 `6e2f64ae947117f6ccbf1efda1b55cb0e2394e4f` 已获取、独立复跑并快进接入主工作区；原 7 个 WIP 文件备份并逐字节保留。负责人已完成语义修正、客户端校验/请求隔离及 SettingsPage 新 API 接线，本地验证结果见 PROGRESS-GUIDE 顶部。源码仍未提交推送，不能按 6e2f64a 部署负责人修改。

公司 employee/reviewer 暂停写入，原 VIEW-02 派单转为历史；不要求公司重复实现或以群内摘要审定尚未取得的负责人代码。当前实现仅资产检查，统一锁和 CLI 交互监督未完成；没有 E 盘更新或新发布授权。

## 当前开发：P2-ENTRY-CAP-02 / P2-ENTRY-VIEW-02

- 用户已要求开始开发及下发任务。固定 base 为 `980d42c46e207be63528c103531ff2472d9ae1a8`，分支 `feat/portable-initializer`；本机原三份文档修改保留。负责人写核心，employee 仅在公司独立工作区写下述两个新文件，不共享目录并行构建，不并发推送。本批开发不自动授权提交推送、安装依赖或更新 E 盘。
- **负责人 CAP-02**：新增 `scripts/entry-capabilities.mjs` 并实际接入 control-server 的 `GET /api/entry-capabilities`；旧 `/api/entries` 不改。固定 schemaVersion=1，五类 kind 为 workbench/cli/tui/dashboard/desktop；assetState 为 present/missing/invalid/unknown，dependencies 固定 unverified，runtime 固定 unknown，launch 固定 `{allowed:false,reason:'LIFECYCLE_NOT_INTEGRATED'}`。不提供任意路径/命令/URL，不读取配置/正文，不探测端口，不启动进程；仅观察服务端既有根下固定资产元数据，根内符号链接保守拒绝。资产存在不证明命令、版本或依赖兼容。
- 新 GET 接口沿用管理认证/Origin/Host 门禁，无请求参数或正文，最多 8 个并行读取，5 秒截止；断开/关闭取消且不占启动停止 busy 锁；响应固定白名单投影，不泄露原始异常。CLI 交互监督和统一入口锁尚未实现，绝不启用启动按钮。
- **Employee VIEW-02 唯一允许新增**：`workbench/src/components/EntryCapabilitiesPanel.tsx`、`workbench/tests/entry-capabilities-panel.test.mjs`。先补失败测试，再写独立纯展示组件；不改任何现有文件，不调用网络或启动器，不添加依赖，不接入 SettingsPage/hook/server。负责人后续负责客户端 decoder、请求身份与页面接线。
- 冻结组件契约：命名导出 `EntryCapabilitiesPanel`；导出 `EntryCapabilityRow`，字段仅 kind（上述五类）、assetState（上述四态）；props 为 `rows:readonly EntryCapabilityRow[]|null`、`loading:boolean`、`failed:boolean`、`canInspect:boolean`、`onInspect:()=>void`。不收令牌、路径、URL或任意错误正文。canInspect=false 时优先显示需认证并隐藏旧结果；其次 loading、failed、rows=null，均不展示旧成功；成功态展示结果。按钮名称“检测入口”，仅 canInspect 且非 loading 时可用；所有模式均无启动/打开动作。依赖未验证、运行状态未知、生命周期未接入须明确说明，present 仅表示资产存在。
- 验收：五类中文标题分别为本工作台、CLI、TUI、原生 Dashboard、Desktop；四种资产状态不得合并为未安装/可用；未认证、加载、失败即便传旧 rows 也不得显示旧成功；空初始态明确；按钮禁用条件正确且不自动调用 onInspect；不得出现命令/路径链接或启动按钮。测试必须导入实际组件，静态渲染不冒充浏览器交互验证。使用现有 React/TypeScript 与 node:test；定向、npm test、validate、build 分别回交退出码，失败/跳过如实列出。
- **Reviewer**：先只读审查上述冻结契约；employee 回交暂停后对其两文件差异和测试敏感性独立验证，不代写核心或并行修改同一目录。负责人未发布的核心源码尚不可在公司复审，不根据群内摘要宣布其通过。
- 回交基线、文件清单、先红后绿证据、命令/退出码、失败/未测项、接口/存储/隐私影响与无越界写入确认；尚未提交时明确结果 SHA 无。代码传输依用户要求经获批 GitHub 提交及精确 SHA，不提供公司本地路径或默认推送授权。同一路径最多三轮失败后报告阻塞，扩大范围先停。

## 四入口方案决定（负责人方案，实施分批验收）

依据 CONTRACT-01A 回交及负责人对 open-hermes.ps1、instance-lock.mjs 的核对，采用“先分清检测语义，再建立协作入口互斥与受控生命周期，最后启用动作”的顺序，不从浏览器直接执行 PowerShell/bat。此节是设计决定，不代表实现或实机验证完成，也不扩大安装、真实实例更新及发布授权。

- 五个展示对象：本工作台、CLI、TUI、原生 Dashboard、Desktop；Gateway 作为相关后台服务风险项，不自动新增产品入口。旧 web 字段兼容解释为本工作台，不直接改名破坏旧响应；新增语义须先锁定版本化接口与未知版本拒绝策略。
- 文件存在、依赖检查、允许启动、运行健康分别表示；缺资产/版本不支持/尚未探测/被占用/结果未知不能混为未安装。路径目录存在不等于依赖可用，禁止自动安装。
- 入口动作由管理服务按固定枚举映射固定适配器；前端不能提交任意命令、参数、路径或 URL。保留认证、Origin、规范路径约束、安全错误投影及请求去重；CLI/TUI 需要本机交互终端，不能用静默后台 Python 或新增浏览器 shell 冒充入口完成。
- 同一规范化 home 的本项目受控入口采用互斥模式切换：P2 管理服务本身可保留，P2 托管实例与备用入口不可并发。停止旧实例需要明确用户操作，确认自有进程树退出并释放本批所有锁后才允许显式启动新模式；失败/断线/未知不自动切换、重试或回收锁。
- 现有锁只协调遵守协议的入口；不能仅凭 manager idle、PID 不存在、检查一次目录或新入口获得锁断言无其他使用者。启用前须将相关便携启动路径纳入共同所有权/锁契约，含 Gateway 与配置写入路径的兼容审计；无法确认的外部旧入口不提供强行启动。避免父包装器与子进程重复取得同一锁，锁由覆盖完整实例生命周期的唯一监督者持有。
- 停止需验证本次进程身份和进程树，优先支持的正常退出；不直接复用 taskkill /T /F，不全局杀进程，不自动清真实锁。正常退出与 Windows 终端宿主/子进程所有权无法验证的模式保持禁用并显示原因。
- 首个候选是 CLI，但仅在固定源码命令、Windows 终端交互、互斥及完整生命周期均有证据后启用；TUI/Desktop/原生 Dashboard 按资产和适配证据逐项开启，不承诺同时完成。新模式不复用 P2 RPC 连接状态来伪造连接成功。
- 核心契约、启动适配、锁/进程监督和安全验证由负责人亲自实施；公司后续仅在接口冻结后承接限定展示层及补充测试，当前不启动新的公司代码批次。最低回归包含已有 P2 实例拒绝、双击一次启动、非自有进程不可停、启动失败/断线未知、父退出子存活不释放锁、缺资产/错误版本拒绝、正常退出后可再次启动、不同 home 隔离。先合成与隔离验证，再集中 Windows 验收。

## 当前任务：P2-ADAPTER-CONTRACT-01A（四入口证据盘点）

- 基线 `980d42c46e207be63528c103531ff2472d9ae1a8`，分支 `feat/portable-initializer`；群聊任务单即正式交接，不要求拉取负责人未提交的文档。此前公司暂停仅对本批只读工作解除。
- Employee：只读盘点仓库启动器、入口检测、兼容清单及其明确固定的 Hermes 源码身份。分别列出 CLI、TUI、原生 Dashboard、Desktop 与本工作台的真实入口定义、参数/工作目录/实例 home 传递位置、依赖与 Windows 适用性、是否创建进程/监听/读写配置，以及未知项；每项提供相对文件:行号和固定 SHA。找不到源码就报告缺证据，禁止猜命令或使用宿主个人安装替代便携目标。仅查非敏感源码和清单，不读取 data、配置、会话或进程命令行；不下载、不安装、不运行启动器或真实模型。
- Reviewer：对同一清单独立只读核查引用、CLI/TUI 是否同一入口、工作台与原生 Dashboard 是否混淆，以及是否涉及另起实例/数据目录冲突；列出漏项和最低验收案例，不并发构建或代写实现。
- 本批不改任何源码/测试/接口，不提交推送，不更新 E 盘，不改变锁或审批。负责人仅维护 HANDOFF/PROGRESS-GUIDE/project_plan；核心适配接口、认证/路径白名单、进程与锁生命周期由负责人亲自设计实现，不委派公司执行。
- 验收：五类对象各有带固定版本的源码证据或明确未知标记；将文件存在、依赖满足、可启动、运行健康四层分开；不得由 entry kind/path 推导任意命令或 URL。回交基线、实际只读命令/退出码、证据矩阵、缺口、无写入确认及下一建议；只读批次结果 SHA 与基线相同。群内回交脱敏矩阵，不提供公司本地文件路径作为交付。最多一轮盘点加一轮补证，缺源或需扩权即停止该项。
- 后续：负责人据证据锁定第一个可安全实施的入口及接口，再下发限定展示层/补充测试批次；本任务不等于四入口实现完成。

## 最新整合交接（2026-10-13）

用户已授权双方提交推送及负责人检查合并；当前代码合并提交为 `2cd4c0aa3a6d55ded3e406c36f71c02c017775c6`，包含负责人 `4ff953c31335ada8581afd541bb6acaa8d0cdbf6` 与公司 `d0c5fb388887f542417e4a10dbb079508d874e1a`。最新实现、测试和剩余门禁只见 PROGRESS-GUIDE 顶部整合节。下方 WIN/HISTORY 派单与“不提交”限制为原批次历史，不覆盖本次明确授权。

公司实现者继续暂停写入；独立审查以最终交付 SHA 为目标，先保护已有补丁和未跟踪文件，不强制覆盖。同步源码不等于更新真实便携实例；本批没有 E 盘部署、真实锁清理或发布授权。

## 当前接续说明（2026-10-13，优先于下方历史派单）

HISTORY 修复已提交推送为 7a85c864cb39f9859fe9f3bb0863ff0b747b6d35，并完成远端回读；公司双方报告已同步，原四文件修改由实现者保存补丁与 stash。用户随后要求继续下发任务，本轮只启动下方 WIN-BASELINE-01，取代先前“暂不追加任务”的安排。公司旧补丁/stash 不恢复、不删除，不因本次派单自动获得提交推送、依赖安装、真实实例更新或发布权限。负责人本轮只维护项目文档，不与公司并行改实现。

### P2-S1-WIN-BASELINE-01：Windows 恢复标记回归定位与测试夹具修复

- 固定基线：`7a85c864cb39f9859fe9f3bb0863ff0b747b6d35`；分支 `feat/portable-initializer`。唯一测试代码写入者为公司实现者，审查者先只读；负责人维护文档。当前群聊任务单作为正式交接，不要求拉取本机尚未提交的派单文档。
- 目标：定位 `lifecycle-boundaries.test.mjs` 的 `startup rechecks recovery marker under its newly acquired lock before spawning`，区分子进程/注入/断言夹具失败与真实生产保护缺陷；只在确认为夹具问题时完成最小测试修复，不凭 Windows 标签认定根因。
- 允许修改：`workbench/tests/lifecycle-boundaries.test.mjs`；确有必要时新增专用 `workbench/tests/lifecycle-recovery-fixture.test.mjs`。生产 scripts/src、package.json、锁文件、项目文档均只读，不顺带改 HISTORY/四入口。若需修改启动、锁、恢复、Windows Job Object 或其他生产机制，交回最小复现，由负责人直接实现，禁止越界代修。
- 先红灯：在相同基线上复跑原失败，记录命令/cwd/真实进程退出码/Node 与 Windows 版本；最小化脱敏诊断应区分 spawnSync error/status/signal、测试注入是否命中、是否到达 spawn、预期拒绝是否发生、marker 是否存在、锁是否释放。不要仅重复 `1 !== 0`，也不要直接公开原始 stderr、环境变量、路径或令牌。
- 调查线索而非已定根因：生产 hermes-instance 对 home/source 做 realpath，测试注入点比较 mkdir 路径是否严格等于拼接 home；需在 Windows 运行证实路径等价与注入是否命中。禁止简单全路径转小写、吞掉 ENOENT 或制造 marker 存在来掩盖失败。
- 契约/验收：恢复标记必须在取得本实例锁的过程中注入，生产持锁复核随后拒绝；spawn 调用计数为 0；marker 原内容保留；仅本批所获锁释放；测试子进程正常退出。不能改成启动前预放标记测试，不能删除断言、跳过该 Windows 用例、放宽安全保护或只增加 timeout 使其假绿。若修复注入 helper，补独立断言防止注入失效被误报通过。
- 验证：既有依赖、合成临时目录与自有子进程；先跑原定向红灯，再跑修复后 `node --test tests/lifecycle-boundaries.test.mjs`（以及新增专用测试）、直接 `node --test tests/*.test.mjs`、`npm test`、`npm run validate`、`npm run build`。逐条记录真实退出码；退出 0 与失败数量矛盾必须查清，不能算通过；POSIX 跳过与其他失败分别列出。生产未改不要求用户实机试零散补丁。
- 审查者：先对同一基线只读核对注入位置、断言敏感性和退出码链；实现者回交并暂停后，在隔离环境验证补丁，禁止在共享目录并行构建/切换/写文件。审查关注补丁是否仍能捕获“持锁前新增 marker 却到达 spawn”的真实回归，而非仅测试 fixture 自己。
- 回交：基线/结果身份（本批不提交，写明补丁）、完整文件清单、原失败与修复后命令/退出码、诊断证据和失败/跳过/未测范围、接口/存储/隐私影响；必须传递包含新增文件的补丁实际附件及 SHA-256，不能仅给公司机器路径。审查者给通过/返工/待环境验证及证据。本批不 commit/push/stash pop，不上传依赖或私人数据。
- 预算：一个独立批次，同一路径最多三轮诊断/修复；未知工作区变更、新依赖、提权、真实服务/模型、生产缺陷或超出允许文件即暂停受影响操作并报告。只清理本批自有临时目录/进程，不修改个人配置或真实 U 盘。

更新：2026-10-12。共享开发分支：`feat/portable-initializer`，远程为 `Zzgj/Hermes-USB-Portable` 的 origin，不是 upstream。
此前 SYNC 批次已同步至 c346ab4；用户随后在群聊要求下发开发任务并更新文档。当前正式下发 HISTORY-01，其他新增需求按总计划登记；不更新真实实例、不发布 RC，不将此前单次推送授权扩展到后续批次。
沿用单分支顺序写入：多 Agent 可同时做只读分析，但同一批只有一名实现写入者。若要改为独立任务分支并行开发，需先明确分支归属与合并责任；本轮没有创建新分支或自动联系公司 Agent。

## 0. 当前接手摘要与首批任务

### 基线和同步

- 推送前远端基线：`b11bd5a7847766c8fd5eb200df2f6ca095ded474`；本地已有提交至 `b986738fac8e5cc594d04891f0bbfca429ba1762`，另有中文启动批次与文档修改。本轮将它们纳入提交并同步；最终 result SHA 以本轮交付消息和远端回读为准，不在提交内容中自引用 SHA。
- 每名 Agent 先核对本机 `git status --short`、`git branch -vv`、`git remote -v`。工作区干净且确认 origin 正确后，执行 `git fetch origin`、`git switch feat/portable-initializer`、`git pull --ff-only origin feat/portable-initializer`，再核对 `git rev-parse HEAD` 与负责人交付 SHA。无本地分支时，可在核对远端后创建跟踪分支；有未提交修改或分叉则停止，不 reset、不强推。
- Git 是源码同步，不是 U 盘运行实例更新。不要在装有 data/Runtime 的实际 U 盘目录直接 pull 代替受控更新；不要同步个人配置、令牌、内网地址、会话、node_modules 或 Runtime。
- 已交付 ONLINE-ZH 包是打包时的源码快照，并非本轮提交的逐字节归档；本轮没有重新打包，原包 SHA-256 仍见 PROGRESS-GUIDE。完整首装 builder 当时位于本机 scratch，不在仓库内；不要把 build-p2-package.mjs 的增量包当空盘首装包。

### 建议三方职责（尚未自动派发）

| 角色 | 首批职责 | 写入边界 |
|---|---|---|
| 本地负责人 | 锁定 base/result、接口与安全边界，独立审查、回归和整合 | 公司实现期间不并行改实现 |
| 公司实现 Agent | 承接下方 HISTORY-01，先复现和补失败测试，再修复 | 经确认后作为该批唯一写入者 |
| 公司验证 Agent | 用同一精确基线独立复现、准备脱敏证据、核对实际环境 | 初期只读；测试代码变更需交给唯一写入者或另行顺序接管 |

### 首批：P2-S1-HISTORY-01（本轮群聊正式下发）

- base SHA：`c346ab4595ab4e3326f0b6f3c2f4bfd555c96835`。分支 `feat/portable-initializer`。唯一实现与测试代码写入者为 @usb-project-employee；负责人本轮只更新文档，之后冻结文档等待回交。公司双方不改这些文档，不提交/推送，回交含新增文件的完整受控补丁。群聊任务单即本轮交接，不要求拉取负责人尚未提交的文档。
- 用户症状：可列出旧会话；点击“只读查看最近 50 条”后历史内容一闪消失，多次点击后无反应；没有可见错误，主聊天仍可正常发送。用户实测失败，本机尚未复现，根因未确认，不预设是 CORS、认证或数据丢失。
- 目标：以无敏感内容的合成会话复现，修复正文持续显示/重复打开/错误可见性问题；不增加旧会话恢复执行。
- 允许范围：`workbench/src/hooks/useLiveChat.ts`、`workbench/src/domain/session-history.ts`、`workbench/src/pages/LiveChatPage.tsx`，必要的相关文案和专用测试；必要时扩展既有浏览器夹具/检查入口但不放宽其他断言。任务状态和证据由负责人统一登记。发现需改内核、生产管理服务、依赖或外部接口时先报告。
- 契约：历史只读；不恢复会话、不发送历史给模型；保留认证、固定本机端点、响应大小限制、纯文本投影、请求取消与迟到结果隔离；不得将正文/令牌写日志。
- 验收：成功正文持续显示到显式关闭；再次打开/切换会话正确；空历史明确；HTTP拒绝/超时/无效数据错误可见并可重试；关闭或换连接后的迟到响应不回填；主聊天不受影响。必须有生产调用点及实际页面回归，不能只测试 decoder。
- 开发侧仅使用已有依赖和隔离合成数据，真实公司模型/数据/主机操作仍按用户权限执行；不索取用户完整会话或配置。三次同一路径失败后报告阻塞，不无限重试。
- 回交 base/result SHA、完整新增/修改清单、实际命令与退出码、首次失败与修复后证据、未测项、接口/存储/隐私副作用；未提交时必须提供含新增文件的完整受控补丁。没有验收证据不得关闭该项。
- 其他 S1 余项与公司实测状态只在 PROGRESS-GUIDE 最新节维护；本批不同时开展模型配置 UI、会话续聊或 S2/S3 重构。

#### 开发侧验证与独立审查

- 允许已有依赖下的隔离合成测试、scratch 产物、dist 构建及自有 loopback 服务/浏览器；不安装、不调用真实模型、不读取私人会话、配置或操作真实 U 盘。先审脚本副作用；只清理本批自有进程与目录。
- 实现者先记录基线失败的精确测试名、断言、命令/cwd/退出码与跳过原因；不能仅凭 Windows 标签确定根因。再记录 HISTORY 首次红灯和修复后的定向、全量、validate、build、实际页面结果。每条独立记录退出码，缺浏览器写明待环境验证，不能跳过成功。
- P2-S1-HISTORY-AUDIT-01：@code-reviewer 对相同 base 先只读核对真实调用链及错误/迟到响应/关闭/重复打开案例，回交文件:行号和缺口矩阵；没有补丁也可做此项。收到实现补丁后，核对完整文件集和基线，再在不影响实现现场的隔离环境回归；本地共享目录内不得并发构建、切换或修改。
- 审查预算：一轮只读矩阵；补丁到齐后一轮独立验证，缺证据列明而非无限重试。实现同一路径最多三次失败后报告。未知现场变更、敏感权限、新依赖或范围外缺陷即暂停受影响操作。
- 回交后实现者暂停，负责人给出通过/需返工/待环境验证，再下发下一批精确基线。代码通过不等于 S1 收口、Windows 验收或发布。

## 1. 顺序交接规则

1. 本机核对干净工作区、远端和实际 HEAD，给出任务单及 base SHA。
2. 公司先核对工作区、分支和基线；同步已获授权且工作区干净后才切换唯一分支、执行 `git pull --ff-only`。分叉、未知修改或同步后基线不符时停止报告，不覆盖。
3. 公司开发期间，本机不修改或推送该分支；必要范围变化先确认。
4. 公司完成测试后按授权提交、正常推送，回交 result SHA，然后暂停写入。
5. 本机在同步与验证授权范围内拉取并审查精确的 base..result，独立复跑验证；返工追加提交，不重写历史。
6. 审查结束再下发下一批及新 base SHA。同一时刻只有一个写入者。

存在未知未提交文件、分叉或推送被拒绝时停止核对；禁止强推、硬重置和清理未知目录。
审查通过不等于发布，也不授权真实系统操作、模型费用或私人数据访问。
两台机器通过 Git 同步源码，不复制 node_modules/Runtime/会话/令牌到公共盘。

沟通入口不替代执行证据，双方遵守 [AI 指南的通用协作规则](../AI_GUIDE.md#双方通用协作规则)。
收到明确且已授权的任务后实际调用工具接手；无法开始时报告阻塞，不只回复“开始执行”。
群聊与私聊接续前核对是否已有执行者，不重复启动。同步仓库不会替换已部署的 SOUL.md；
接手时重新读取指南，角色规则冲突须报告并在授权后修正，不能假定旧会话已加载新规则。

## 2. 本轮整合记录

- 外部交付：dff159bed2c275d1b6a9c7c0c04c5b7bddf58bda。
- 本机检查点：190cc892d931d27926b97bc0c8d6abf28a6d1e03。
- 两者合入唯一分支并保留提交历史；交接分支删除后仍可按 SHA 查阅。
- 保留本机管理令牌隔离、prepare-capability、确认后二次重核和轮次卡片关联。
- 保留外部独立模块/测试及有用的 Profile/Skill 副作用说明；独立模块存在不代表生产功能接通。
- 修复学习来源 props、文案与请求失效接线；增加学习来源投影和设置页渲染测试。
- 移除设置页定时器模拟“检查完成”；未接入的更新与入口检测明确不可用。
- 不接入虚构恢复时间或固定“无未完成工具”状态，保留通用恢复风险提示。
- 文档仍使用总计划+AI 指南+阶段目录，旧回交报告从 Git 查看，不复活重复导航。

## 3. 原审查问题的真实状态

| 编号 | 问题与处置 | 剩余事项 |
|---|---|---|
| R1 | 卡片目录/准备接错服务；整合采用独立管理服务与令牌 | 不同端口/令牌浏览器及目标实例复验 |
| R2 | 执行仅信任缓存指纹；整合保留确认后二次读取重核 | 文件变化、换实例、断线、防重放整合复验 |
| R3 | 更新/入口检测伪造结果；改为明确未接入且禁用 | 真实双通道更新和入口后端仍待实现 |
| R4 | 持久化仅有工具模块，未形成实例库 | 确认便携目录、白名单字段、迁移及接入 |
| R5 | Skill 目录摘要不等于机器/依赖环境指纹 | 定义真实适用环境和证据绑定，不能授信旧结果 |
| R6 | 恢复使用虚构时间/安全状态；未采用该接线 | 核对真实恢复契约，未知状态与副作用确认 |

此外：证据工具模块的额外字段投影/敏感数据风险需解决后才能接入。
学习提示准备不等于 Skill 已生成或业务验证成功。
Windows installer/大小写测试的历史失败本轮未复核，不能用 Linux 全绿关闭。
P0 最终验收、P2 Windows 服务树停止/迁移、真实模型审批仍待对应证据。
`release_ready:false` 保持不变；本次不是 RC 或完整 P2 交付。

## 4. 下一批任务

S0 保存与整合已完成，两处构建错误已修复，不要重复创建检查点分支。
负责人先查看 [当前进度](PROGRESS-GUIDE.md)，选择一个小批次：
- 复验现有卡片/学习接线的浏览器失败与迟到响应路径；
- 或先明确能力/证据实例存储契约，再实现最小白名单投影和接入。
有依赖的批次按顺序完成，不以“完成 P2”作为无边界任务。

## 5. 任务与回交模板

```text
任务 ID：
分支：feat/portable-initializer
base SHA：
当前唯一写入者：
目标和允许修改范围：
禁止事项、接口/数据契约：
验收案例、测试环境与授权：
执行预算、重试上限与暂停条件：
当前状态及执行证据（已接收/已开始/部分完成/阻塞/待审查）：
交付 result SHA：
新增/修改文件及副作用：
工作目录 | 命令 | 退出码 | 证据 | 未覆盖范围：
单元/静态/构建：
合成浏览器/隔离接口：
真实模型/Windows/U盘（未做明确写未测）：
已知问题与负责人重点审查位置：
阻塞事实、尝试次数及所需资源/授权（无则写无）：
仍在运行的任务/进程及归属（无则写无，未知如实标注）：
已推送并暂停写入，等待审查：
```

每批只更新 PROGRESS-GUIDE、VALIDATION 和必要总计划，不新增重复长期报告。
集中包前对照 [ACCEPTANCE](ACCEPTANCE.md)，核对源码、构建、白名单、兼容性与哈希。
