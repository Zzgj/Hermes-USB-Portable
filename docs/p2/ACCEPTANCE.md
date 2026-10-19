# P2 开发测试包与集中验收清单

此清单用于后续集中测试，不要求现在插入 U 盘或执行安装。
开发快照不是 RC；P0 的通过项不自动证明 P2 通过，P2 也不替代 P0 验收。
已确认使用自有工作台作为主界面，原版 Web/CLI/TUI 为备用。
更新方案为自动检查通知、确认后安装，内核与外壳独立；该方案的确认不代表功能已经实现。

## 公司环境开发测试批次（2026-10-09 修复版）

旧包（SHA-256：81a7115b24312ccc3c7573ead37440d56cf41aef374815438f1efefd15e5e49b）因生命周期缺陷已暂停，不能继续使用。此次源码已修复关闭异常、恢复标记竞态及 POSIX 普通后代进程清理；只使用附有最终归档验证结果与新 SHA-256 的替代包，不因本说明存在就把未验证候选包当作交付。

Linux 新增进程组停止覆盖普通后代，不承诺终止主动 setsid 脱离进程组的工具；进程不可终止或僵尸未回收时保持停止未确认及锁，不以超时当作完成，不手工清锁。Windows 保留 Job Host 路径，其进程树仍须本轮公司实机验收。管理关闭失败时可以重试 EXIT 或停止信号；仍未确认则保留现场，不拔盘。

用户决定将真实模型测试留到公司环境，按用户说明可使用内网 GLM 5.2；本机不验证其可达性、模型标识或费用，也不把内部地址/凭据写入本包。此包用于集中暴露 S1 接线与 Windows 问题，不意味着 P2-01～19 全部完成或达到 RC。

### 包含与不包含

- 包含已构建工作台、P2 管理/启动/安装恢复脚本、兼容性清单和现有说明文档。无需在公司运行 npm install 或从互联网拉取前端依赖。
- 不含 Hermes 内核、Python/Node/Git Runtime、node_modules、用户数据、配置、凭据或公司网络参数。**这是 P2 外壳增量包，不是新电脑可直接运行的全套便携安装器。**
- 前提是已有可独立使用的 P0 Windows 便携测试根；根内含 launch.bat、src/hermes-agent、.cache/runtimes/windows-x64、manifests。运行时已经按该机器/目录完成 P0 校验及路径修复。不要用唯一工作实例作安装目标，不将旧实例个人数据整目录复制到测试根。
- Linux 仅对固定内核 28044757aabd34010bd9f5f3e3f82b0906b46241 做过无模型真实服务验证；公司实际内核需独立记录，不能仅凭契约号 6 宣称兼容。本包不更新内核、不安装模型、不保证所有基线都支持公司模型。
- 真实聊天入口为 /chat/live；/chat、/tasks/demo 是演示。更新与备用入口的未接后端部分、能力实例库与可信证据、学习文件实际产出闭环仍未完成，不将页面存在记为功能通过。

### 安装与启动（Windows PowerShell）

1. 在独立目录解压，并用 Get-FileHash -Algorithm SHA256 核对收到的 ZIP 与随附 .sha256。包内 p2-package.json 列出文件大小和 SHA-256；外层哈希一致只证明传输一致，不替代可信来源确认。
2. 关闭**目标测试根**的工作台/Hermes，不关闭其他实例。以下路径仅为示例，须在公司机器上替换：

```powershell
$package = 'C:\P2-Test-Package\Hermes-Portable-P2'
$target = 'E:\Hermes-P2-Test'
& "$package\scripts\install-p2-package.ps1" -Target $target -VerifyOnly
```

预检失败就停止，保留现场。不要更改哈希清单、删除锁/中断标记、关闭认证或绕过公司脚本执行策略来强行通过。

3. 预检通过后执行下面命令，在显示的目标无误时输入 INSTALL。仅更新白名单中的 P2 外壳文件，旧外壳备份保留在目标 logs/diagnostics；不把此备份称为业务数据回滚。

```powershell
& "$package\scripts\install-p2-package.ps1" -Target $target -Experimental
& "$target\scripts\start-p2-workbench.ps1" -Root $target -Experimental
```

4. 打开管理页并不自动启动内核。用页面显式启动本实例并连接；不要粘贴或分享带 control/token 的 URL。终端输入 OPEN 仅重新打开管理页；输入 EXIT 停止本管理器及其自有实例。停止未确认时不要拔盘。
5. 公司模型由用户在**该独立测试根的原生 Hermes 配置入口**配置；确认配置属于 target/data，不是默认个人 Profile。本包不提供内网地址，不采集 API Key，不要求在聊天中粘贴配置。若内核需要升级或依赖安装，单独批准，不通过本测试包自动处理。

### 第一轮集中测试与回交

按顺序先完成下面有限范围；出现认证/停止/数据保留问题即暂停，不继续有副作用的测试。

| 场景 | 需要观察的结果 |
|---|---|
| 启动与停止 | 只操作本测试实例，重复启动不产生第二个内核，停止后其他实例不受影响 |
| 模型普通回复 | /chat/live 使用用户配置的模型获得真实流式回复，错误可见，不把失败记成完成 |
| 无害工具与审批 | 只在自建临时合成文件目录读写；分别拒绝一次、单次批准一次，以工具事件和目标文件结果核对，批准不扩散到另一请求 |
| 活动取消与断线 | 请求取消后等待真实终态；断线显示未知，不自动重放；不要为了测试拔出运行中的 U 盘 |
| 能力准备与重核 | 只选专用测试 Skill，先审阅未确认不提交；修改测试 Skill 后旧请求拒绝；重复点击最多一次提交 |
| 结束与数据保留 | 原配置和合成测试数据保留，关闭只影响自有服务；若失败保留错误分类与备份，不手工清锁 |

回交仅含：外层包 SHA-256、Windows/Node/Python 版本、内核完整 SHA、各场景通过/失败/未测、发生问题的步骤和脱敏截图。不要回传凭据、完整配置、公司内网地址、真实业务文件、完整会话或未脱敏诊断包。模型名称可记录，但不要把用户所述“免费”当成已验证调用结果。

### 安装中断恢复

出现 p2-install-active.json 时不要重装覆盖。先关闭目标实例，然后只读核验：

```powershell
& "$package\scripts\install-p2-package.ps1" -Target $target -Recover -VerifyOnly
```

恢复核验通过且已确认需要恢复中断安装时，使用同一命令去掉 -VerifyOnly、增加 -Experimental，并核对后输入 RECOVER。它只恢复中断的 P2 外壳写入，不回滚模型/工具业务操作；正常成功安装后的降级不由这个入口自动完成。恢复核验失败应回报脱敏错误，保留目标、标记与备份。

## 本轮新增前置门（2026-09-20）

- [x] S0 完整保护/整合本机 WIP 与外部交付，唯一基线 feat/portable-initializer（2026-09-21）。
- [x] 两处 TypeScript 构建失败已修复，并重新构建（2026-09-21）。
- [ ] HANDOFF 中 R1～R6 已修复或明确限制；阻塞问题不能只记为“待实机”。
- [ ] 管理服务与 Hermes 用不同端口/令牌验证，目录/聊天不能共用假服务掩盖接线。
- [ ] Skill 在审阅后变化、换实例、断线及重复点击均不错误提交。
- [ ] 卡片/证据存储的字段、实例归属和迁移范围已确定；无令牌/永久审批落盘。
- [ ] 文档、包白名单和所有必需文件一致，已删除旧文档不被再次打包。

## 开发侧交付门槛

- [ ] 对照 Stitch 完成颜色、字体、间距与明暗主题校准。
- [ ] 页面真实会话：流式回复、工具活动、审批、失败与取消均有整合证据。
- [ ] Agent/Profile、Skills、MCP 接口盘点完成；第一版最小选择/查看入口可用，不支持项明确提示或转原入口。
- [ ] 任务中心只映射 Hermes 真实事件；不以模拟流程引擎作为生产执行机制，不承诺通用业务回滚。
- [ ] 安装中断后的恢复入口与说明完整；不能要求用户盲目删除锁或恢复标记。
- [ ] Windows 进程树退出验证通过；服务停止不影响其他 Hermes 实例。
- [ ] 核对内核提交和协议契约，列出已验证基线与不支持情形。
- [ ] 窄屏、高 DPI、键盘导航及中英文范围明确并完成对应检查。
- [ ] 构建测试包、外层 SHA-256、文件清单、安装/回退说明和已知问题表。
- [ ] 交付包中的功能标注与实测一致：模拟流程不标成真实系统执行。
- [ ] 更新入口区分检查与安装、内核与外壳；未实现项明确提示，不静默安装或显示虚假成功。
- [ ] P2-16～19 能力卡片、参数调用、`/learn` 发起和验证状态接线；完整真实方法内容与跨机复验归 P3，不用静态卡片代替功能验收。

## 用户侧集中测试顺序

最终包发布时再提供确切下载地址、哈希与安装路径；不从本草案猜测包名或命令。
先使用独立测试实例，不覆盖唯一一份工作数据。保留原启动器作为独立回退入口。

| 次序 | 测试 | 通过标准 |
|---|---|---|
| 1 | 安装前只读预检与安装 | 错误包拒绝；正确包只更新 P2 外壳，输出备份位置，原数据不变 |
| 2 | 启动管理页面 | 仅监听本机；打开页面不自动启动内核；令牌不留在地址栏或日志 |
| 3 | 显式启动与重复启动 | 主动启动后健康检查通过；重复启动被拒绝，不出现第二个实例 |
| 4 | 新会话、普通回复、工具活动 | 真正收到回复；工具开始/结束可区分；错误不是成功状态 |
| 5 | 单次批准与拒绝 | 展示原因、命令与范围；拒绝不执行；批准只作用于该请求 |
| 6 | 运行中取消、断线 | 取消等待终态；断线显示结果未知，不自动重发或重复授权 |
| 7 | 停止、关闭窗口 | 正常停止清理自有服务；异常关闭后的子进程回收有证据；其他实例不受影响 |
| 8 | NTFS U 盘换目录/盘符 | 修复后运行路径属于新实例；不借用旧盘路径、凭据或开发机环境 |
| 9 | 重新插入及第二台 Windows | 页面、真实聊天、工具、停止仍正常；宿主检查结果逐项解释 |
| 10 | 两种工作流演示 | 打印机与文档归档具有不同步骤和输入；审批、取消保持正确；明确标注模拟 |
| 11 | UI 与回退入口 | 明暗主题、缩放、键盘可用；CLI 等入口可达；未安装能力明确提示 |
| 12 | 最小配置与 Skill 入口 | 选择/查看对应 Hermes 已有配置；不伪造配置成功；真实跨机方法复用归 P3 验收 |

不使用真实删除、驱动安装或管理员命令来验证审批，优先使用无副作用的测试命令。
遇到校验失败、未知进程所有权或中断安装标记时停止操作并保留现场；不强制覆盖。

## 需保留的验收证据

能力复用新增检查：

- 卡片能追溯对应 Skill/Bundle 和版本/内容指纹；无证据的外部方法显示待验证。
- 只展示真实执行与验证结果；命令退出成功、模型声称完成不能单独充当业务成功证明。
- `/learn` 经确认后执行，返回草稿不自动发布为已验证；失败或写入未确认不假报成功。
- 修改 Skill/Bundle 后旧证据仍可查，但当前版本提示重新验证；缺依赖/换环境不自动继承适用性。
- 分享卡片/记录不包含旧电脑凭据、审批授权或完整私人会话。

记录包哈希、外壳版本、内核完整提交、Windows 版本、文件系统及运行根路径；
每项记录通过/失败/未测及对应日志位置。分享前移除 API Key、临时令牌、私人会话和环境文件内容。
可选组件未安装记为“未安装/未测”，不能通过修改检查结果把它变成通过。

## P2-CLI-BASELINE-03：CLI 接入前的锁并发、进程所有权与验收证据

基线：`4136c30c08847b68656982b3d6971b5333935142`（P2-CLI-BASELINE-04 返工）

### T1：锁并发与隔离测试

- 测试文件：`workbench/tests/entry-lock-concurrency.test.mjs`
- 生产调用位置：`workbench/scripts/instance-lock.mjs`（`acquireInstanceLock`）
- 命令：`node --test tests/entry-lock-concurrency.test.mjs`，退出码 0，5/5 通过
- 合成层级：Node.js 子进程通过 ready/go 屏障同步争抢同一 `home` 目录的 `.p2-manager-lock`
- 测试稳定化（P2-CLI-BASELINE-04）：
  - 子进程先报告 `ready`，父进程确认双方就绪后发送 `go`，确保真实同时争抢
  - 使用 `LineQueue` 消息队列处理分块/多行 stdout，超时和提前退出均报错
  - `trackChild` 在 spawn 时即注册退出观察，所有路径（含断言失败）均清理子进程
  - 先回收进程再删临时目录；stdin `end()` + `on('error')` 防止 EPIPE
  - Test 5 文案已修正为"同进程验证"（非子进程）
- 验证内容：
  1. 两进程经 ready/go 同步后争抢同一 home：恰好一个取得锁，另一个收到 `INSTANCE_LOCKED`
  2. 失败者不修改持有者的 `owner.json` 内容
  3. 持有者释放后可重新取得锁
  4. 不同 home 可同时持锁，释放一个不影响另一个
  5. `owner.json` 被替换后释放拒绝，替换内容保留（同进程验证）

### T2：Windows Job Host 生命周期补证

- 测试文件：`workbench/tests/test_windows_job_host.py`
- 生产调用位置：`workbench/scripts/windows-job-host.py`、`workbench/scripts/hermes-instance.mjs:23`
- 命令：`python tests/test_windows_job_host.py -v`，退出码 1，5 pass / 1 fail
- 合成层级：Windows 原生 Job Object + 合成 Python 子进程 + importlib 导入生产模块
- 测试稳定化（P2-CLI-BASELINE-05）：
  - T1 `LineQueue` 每次等待独立管理 timer 和完成状态；成功/超时/退出时 `clearTimeout`；旧 timer 不能拒绝新请求；只允许一个挂起 `nextLine()`
  - T1 `trackChild` SIGKILL 后有界等待并确认退出，不用固定 500ms sleep；`CleanupTracker` 确认所有子进程退出后才删根目录；`t.after` 按注册顺序(FIFO)执行，root cleanup 最后注册
  - T1 `LineQueue` 处理 stdout `end` 事件，保留最后一行不丢失
  - T2 `_cleanup_handles_and_readers` 统一清理：kill host → 检查 `TerminateProcess` 返回值 → 检查 `WaitForSingleObject` 返回值为 `WAIT_OBJECT_0` → `join(timeout=5)` 后检查 `is_alive()` → 关闭流
  - T2 异常路径和正常路径统一进入清理流程；两个 reader 都 join 并检查 `is_alive`
  - T2 A/B 存活断言只接受 `WAIT_TIMEOUT(258)`，不接受 `WAIT_FAILED` 或其他非零值
  - 退出码断言保留失败状态，不跳过
  - containment 测试通过 importlib 导入生产模块 + mock 验证
- 验证内容与结果：

| 测试 | 结果 | 说明 |
|------|------|------|
| `test_host_termination_cleans_child_and_grandchild` | ✅ 通过 | 宿主终止后子进程和孙进程被回收 |
| `test_manager_pipe_loss_cleans_child_and_grandchild` | ✅ 通过 | 管道断开后子进程和孙进程被回收 |
| `test_direct_child_exits_grandchild_survives_then_host_cleans` | ✅ 通过 | 子进程退出后孙进程仍被回收 |
| `test_two_independent_instances_closing_a_does_not_affect_b` | ✅ 通过 | 关闭 A 不影响 B 的子进程 |
| `test_containment_failure_aborts_before_child_starts` | ✅ 通过 | importlib 导入生产模块，mock containment 失败，断言 RuntimeError 抛出且 Popen 未调用 |
| `test_child_exit_code_propagation` | ❌ **失败（生产缺陷）** | 期望退出码 42，实际 3221225477 |

**生产缺陷最小复现**：
- Python 3.14.7，Windows 10
- 子进程 `sys.exit(42)`，宿主 `host.wait()` 返回 3221225477（0xC0000005 ACCESS_VIOLATION）
- stderr 含 `Fatal Python error: _enter_buffered_busy: could not acquire lock for <_io.BufferedReader name='<stdin>'> at interpreter shutdown, possibly due to daemon threads`
- 原因：`windows-job-host.py` 的 daemon `parent_watch` 线程在解释器关闭时崩溃，损坏退出码传播
- 此缺陷由 lead 负责修复

### 集中验证矩阵

| 命令 | 工作目录 | 退出码 | 结果 |
|------|----------|--------|------|
| `node --test tests/entry-lock-concurrency.test.mjs` | workbench | 0 | 5/5 通过 |
| `python tests/test_windows_job_host.py -v` | workbench | 1 | 5 pass / 1 fail（退出码传播生产缺陷） |
| `npm test` | workbench | 见回交 | 全量结果 |
| `npm run validate` | workbench | 见回交 | 组件检查 |
| `npm run build` | workbench | 见回交 | tsc/Vite 构建 |

### 尚未实现、不能勾选通过的 CLI 门禁

以下门禁由 lead 负责实现，本批不声称完成：

- [ ] 终端交互输入（`windows-job-host.py` 的 `stdin=DEVNULL` 不支持 CLI 交互）
- [ ] 同 home 模式切换（P2 托管实例与 CLI 互斥）
- [ ] 旧启动器（`launch.bat`）及 Gateway 路径的协调与锁纳入
- [ ] 身份不明时拒绝启动
- [ ] 断线保持未知，不自动重试
- [ ] 完整进程树退出后才释放锁（`managed-instance.mjs` 的 `lock.release()` 在 `child.exited` 后执行）
- [ ] 子进程退出码正确传播（**生产缺陷已复现**：daemon 线程崩溃导致退出码损坏，`test_child_exit_code_propagation` 失败，由 lead 修复）

### 未测范围

- 未做浏览器端 CLI 启动交互验证（功能未实现）
- 未做真实 Hermes CLI 进程启动（仅合成测试进程）
- 未做 E 盘实机验收
- POSIX 进程组测试在 Windows 上跳过（9 项），不作为通过

## P2-09-NATIVE-01 原生入口验收矩阵（NATIVE-COVERAGE-02，源码 `41387cdb`）

本批只补回归测试与验收指引，不改生产实现。以下“自动合成证据”均为 Node 测试证据，**不是浏览器点击、Windows 实机或模型验证**。历史记录上方保留，不复用旧结论。

### 操作步骤（设置页，仅认证后可用）

1. 在 AI 对话页完成管理服务认证；未认证时面板只显示“需认证”，所有动作禁用。
2. 点“读取原生入口状态”。状态为 `unknown` 时必须先读取，不自动启动、不清锁。
3. 勾选风险确认（启动可能读取本实例配置；停止可能中断任务）。
4. 点“启动 CLI”或“启动原生 Dashboard”；确认随即被消耗，重复点击无效。
5. 管理器回报 `accepted` 后**自动重读状态**；读取失败则回到 `unknown`，不自动重试。
6. 仅当 `kind=dashboard` 且 `state=running` 时“打开已运行的 Dashboard”可用；CLI 入口永远不可打开 Dashboard。
7. 停止需再次确认；停止后须确认整棵进程树退出才释放锁，本页不断言进程已退出。

### 场景矩阵

| 场景 | 期望行为 | 证据层级 | 对应测试 |
|---|---|---|---|
| 未认证 / 请求进行中 | 隐藏旧成功结果，全部动作禁用 | 自动合成 | `unauthenticated and pending panels cannot invoke any action`、`pending and unauthenticated states hide stale success and block every action` |
| 未勾选确认 | 启动/停止按钮禁用，直接触发事件也不产生动作 | 自动合成 | `unconfirmed gate blocks every mutating action even for stray events` |
| 确认后启动 | 仅一次动作，确认被消耗 | 自动合成 | `confirming enables the idle start action and the click consumes the confirmation` |
| 刷新 | 清除确认，只读状态，不触发动作 | 自动合成 | `refresh clears the confirmation and only refreshes` |
| 状态 `unknown` | 禁止启动，需显式读取；动作失败后仍 `unknown` | 自动合成 | `unknown cannot start…`、`status read failure after acknowledgement stays unknown without retry` |
| 动作已应答但状态读取失败 | 保持 `unknown` 且标记失败，无自动重试 | 自动合成 | 同上 |
| 响应正文异常 | 正文挂起取消、累计超 4096 字节、非法 UTF-8、截断 JSON 一律拒绝 | 自动合成 | `cancelling a pending body…`、`chunked bodies over the byte limit…`、`invalid utf-8 and truncated json are rejected` |
| 403/409/500 | 只暴露固定错误码，不泄露正文，正文被取消 | 自动合成 | `error responses expose no body text and are cancelled` |
| 身份切换 / 往返 / 卸载 | 旧请求被中止，迟到响应不覆盖新状态，旧回调不发起动作 | 自动合成 | `identity round trip fences the previous generation and its actions`、`late rejection after unmount cannot mark a failed state` |
| CLI 入口打开 Dashboard | 始终禁用/无效 | 自动合成 | `a CLI entry can never open a Dashboard view` |
| 停止 | 需确认；`idle` 时按钮禁用（只断言渲染态） | 自动合成 | `stop requires an explicit confirmation; only the disabled state is asserted while idle` |
| 失败后显式停止 | failed 时启动/打开被抑制，刷新可用，确认后仍可显式停止 | 自动合成 | `failed state blocks start and open but keeps refresh and an explicit confirmed stop` |
| 未知后显式停止 | `unknown`+failed 仍可经确认显式停止，不自动启动 | 自动合成 | `unknown after a failed request still permits an explicit confirmed stop` |

### 仍未验证（不得勾选为通过）

- [ ] 浏览器真实点击与页面渲染：本批为合成调度器事件回调，三个浏览器脚本仍在 setup 阶段失败，未进入业务断言。
- [ ] Windows 实机：CLI 独立控制台交互输入、整棵进程树退出确认、Job 归属与父管道关闭。
- [ ] 同 home 互斥：P2 托管实例与 CLI/Gateway 的模式切换。
- [ ] 旧入口（`launch.bat`、Gateway）与配置写入路径的绕行拒绝。
- [ ] 未知状态不清锁、不自动重启在真实锁文件上的行为。
- [ ] 固定 Hermes 版本与 P0 启动器匹配前提（版本/资产不一致时应拒绝而非安装或构建）。
- [ ] 模型调用与实际任务执行：本批不调用模型，CLI 进程创建不等于交互可用。

自动合成测试通过只说明上述客户端/组件契约成立，不替代 Windows／U 盘验收，也不构成发布授权。

## P2-09-NATIVE-PACKAGE-03 P2 增量包完整性与启动器匹配

**P2 增量包不是完整启动外壳。** 它只把白名单内的源码与构建产物放进 `Hermes-Portable-P2`，`release_ready` 固定为 `false`；`launch.bat`、`scripts/open-hermes.ps1`、`scripts/start-web-workbench.ps1` 属于 P0 外壳，**不在增量包内**，必须由已安装的 P0 交付提供，且与包内 `portable-entry-guard.json` 记录的哈希一致。有包内文件名不等于安装后可启动。

### 运行前提（缺一项即拒绝，不自动修复）

| 前提 | 校验方式 | 拒绝表现 |
|---|---|---|
| 目标根含 `data/` 且与传入 home 指向同一目录 | `realpath(root/data) === realpath(home)` | `PORTABLE_ENTRY_HOME_MISMATCH` |
| 四个协调文件存在且哈希匹配（`launch.bat`、`scripts/open-hermes.ps1`、`scripts/start-web-workbench.ps1`、`workbench/scripts/legacy-hermes-entry.mjs`） | 按 LF 归一化后的 SHA-256 与包内 guard JSON 比对 | `ENTRY_COORDINATION_UNCONFIRMED`（缺失时为 ENOENT） |
| 无进行中的安装/恢复 | 不存在 `logs/diagnostics/p2-install-active.json`、`updates/hermes-restore-active.json` | `INTERRUPTED_INSTALL_REQUIRES_RECOVERY` |
| 无外部旧入口占用 | 不存在 `<home>/gateway.pid`（不做 PID 存活推断、不自动回收） | `EXTERNAL_ENTRY_REQUIRES_REVIEW` |

### 场景矩阵（`node --test tests/native-package-contract.test.mjs tests/package.test.mjs tests/portable-native-entries.test.mjs`，本机以隔离临时目录复跑：19 通过 / 0 失败 / 0 跳过，退出码 0；该结果只对应本批提交的测试文件，不是负责人复验）

| 场景 | 期望 | 证据层级 | 对应测试 |
|---|---|---|---|
| 白名单真实源码 staging | 逐文件字节/大小/SHA-256 与源一致，manifest 无重复，`release_ready=false` | 自动合成 | `staging copies real whitelisted sources byte for byte and stays non-releasable` |
| 原生模块完整性 | host/协议/adapter/manager/guard/JSON 等 12 个文件在包内且非空 | 自动合成 | 同上 |
| P0 文件不在增量包内 | `launch.bat` 等不出现在 manifest | 自动合成 | 同上、`native payload includes complete composition without taking over P0 launchers` |
| 匹配的 P0 启动器组合 | 真实 guard 正常返回；无锁时不新建锁，预置锁时原文不变 | 自动合成 | `the staged guard accepts a matching P0 launcher set and never takes the instance lock` |
| 协调文件 LF / CRLF 等价 | 分别按 LF、CRLF 实际写入目标并读回确认换行后再调用包内 guard，两种均通过 | 自动合成 | `the staged guard accepts LF and CRLF copies of the coordination files` |
| 非 LF/CRLF 换行 | 仅归一化 CRLF；裸 CR 是不同字节，`ENTRY_COORDINATION_UNCONFIRMED` | 自动合成 | `the guard rejects coordination files whose line endings are neither LF nor CRLF` |
| 只有 P2 输出、缺 P0 启动器 | 拒绝；无锁仍无锁、已有锁原文不变 | 自动合成 | `the guard rejects a P2-only root without the P0 launchers and leaves the lock untouched` |
| 旧版或被篡改启动器 | `ENTRY_COORDINATION_UNCONFIRMED`；锁状态不变 | 自动合成 | `the guard rejects a stale or tampered launcher and leaves the lock untouched` |
| 缺 legacy 协调模块 | 拒绝；锁状态不变 | 自动合成 | `the guard rejects a missing legacy coordination module and leaves the lock untouched` |
| 仅安装标记存在 | `INTERRUPTED_INSTALL_REQUIRES_RECOVERY`，标记原文保留，不创建恢复标记，锁状态不变 | 自动合成 | `an install marker alone refuses entry, preserves the marker and leaves the lock untouched` |
| 仅恢复标记存在 | 同上；证明第二个检查可独立触发，不被安装标记短路 | 自动合成 | `a restore marker alone refuses entry, preserves the marker and leaves the lock untouched` |
| 安装与恢复标记同时存在 | 拒绝，两个标记原文保留，锁状态不变 | 自动合成 | `both markers together refuse entry and both are preserved verbatim` |
| 外部 gateway 收据 | 拒绝，收据与既有实例锁都不被清除；无锁时不新建锁 | 自动合成 | `an external gateway receipt is refused without clearing the receipt or an existing lock` |
| home 不是 `<root>/data` | `PORTABLE_ENTRY_HOME_MISMATCH`，不改动该 home 的锁 | 自动合成 | `a home that is not the portable data directory is refused and never takes its lock` |

锁不变断言的判定范围是 `<home>/.p2-manager-lock/` 整个目录：先记录目录是否存在、`owner.json` 原文（base64）与目录项列表，调用后再逐项比对。每条路径都在无锁 home 与预置锁 home 各执行一次，因此“无锁仍无锁”和“已有锁内容不变”分别有独立证据；guard 是准入检查而非锁管理器，成功路径同样断言不创建锁。全部证据仍是合成目录与进程内调用，不构成 Windows 实机或 U 盘验收。

### 被拒绝后的处理

拒绝只说明安装一致性未确认，**不清理实例锁、不删除或改写安装/恢复标记、不自动停止外部进程、不自动安装/构建**。处置顺序：保留标记原文，先只读核查中断事务与恢复证据；“确认没有运行中的旧实例”本身不构成删除标记的依据，真实恢复动作须另获用户批准后执行，再重新校验。`accepted` 只代表操作被接收，CLI 进程被创建也不等于交互可用。

### 本批仍未验证（不得勾选）

- [ ] Windows 实机安装/升级、真实 `zip` 归档与 U 盘复制
- [ ] 真实 P0 外壳与真实 Hermes 配置共同运行的端到端流程
- [ ] 浏览器点击、CLI 交互输入与模型调用
- [ ] 增量包安装后的整棵进程树退出与锁释放实机证据

## P2-09-GUARD-ORDER-03 持锁 guard 时序补证（`workbench/tests/portable-guard-order.test.mjs`）

此前"guard 持锁时序"只有静态结论。本批用受控屏障补动态证据：在隔离 Node 子进程中，动态 import 生产模块**之前**替换 `fs.promises.readFile` / `fs.promises.lstat`，按完整规范路径（`realpath` 后的绝对路径字符串）限定命中范围；未命中即测试失败，因此证据不能靠"钩子静默不触发"通过。不使用固定 sleep。

生产调用链（源码 `2ffcb087`）：`createPortableNativeEntries`（`portable-native-entries.mjs:7-11`）→ `createNativeEntryManager`（`native-entry-manager.mjs:20-32`）→ `createNativeEntrySession.start`（`native-entry-session.mjs:9-23`，先 `acquire()` 再 `prepare()`）→ `manager.prepare` 内 `checkRecovery()` → `beforePrepare` = `assertPortableEntryGuard` → `adapter.prepare`。因此 guard 必然读文件于实例锁与 `owner.json` 写入之后。

### 场景矩阵（`node --test tests/portable-guard-order.test.mjs tests/portable-native-entries.test.mjs tests/native-entry-manager.test.mjs`，本机隔离临时目录与隔离 Node 子进程：10 通过 / 0 失败 / 0 跳过，退出码 0）

| 案例 | 生产调用点 | 屏障/注入点 | 可观测断言 | 证据层级 |
|---|---|---|---|---|
| 匹配组合正常启动 | `session.start` → `manager.prepare` → `assertPortableEntryGuard` → 合成 `adapter.prepare` → `adapter.start` | `fs.promises.readFile` 命中 `<root>/launch.bat` 全规范路径（guard 逐文件哈希校验处） | 命中恰 1 次；命中时 `.p2-manager-lock/` 与 `owner.json`（`schema:1`）均已存在；此时 adapter `prepare`/`start` 计数均为 0；随后 `prepare`/`start` 各 1 次；运行中锁仍在；显式 `stop()` 后状态 `idle`、锁目录消失、`acquireInstanceLock` 可重获并释放 | 自动合成（真实 manager/session/guard/锁，合成 adapter，无业务进程） |
| 屏障内新增安装恢复标记 | `manager.acquire`→`manager.prepare` 的 `checkRecovery()`；屏障取 guard 自身的 `lstat(<root>/data)`（`portable-entry-guard.mjs` 首个文件系统调用，位于持锁后、标记校验前） | `fs.promises.lstat` 命中 `realpath(home)` 时写入 `logs/diagnostics/p2-install-active.json` | `INTERRUPTED_INSTALL_REQUIRES_RECOVERY`；adapter `prepare`/`start` 均为 0；标记原文逐字节保留；本批锁已释放、可重获 | 自动合成 |
| 屏障内篡改协调启动器 | 同上，随后进入 guard 的逐文件 SHA-256 比对 | 同一 `lstat` 屏障内改写 `<root>/launch.bat` 字节 | `ENTRY_COORDINATION_UNCONFIRMED`；guard 读取协调文件发生 1 次且当时锁在；adapter `prepare`/`start` 均为 0；篡改字节保留；锁释放后可重获 | 自动合成 |
| 预置他人实例锁 | `session.start` 的 `acquireInstanceLock`（guard 之前） | 不注入，启动前写入 `.p2-manager-lock/owner.json` 外部字节 | `INSTANCE_LOCKED`；guard 未读协调文件（0 次）；adapter `prepare`/`start` 均为 0；`owner.json` 原文不变；测试不调用生产 `release()` 清除他人锁，由夹具删除 | 自动合成 |

"匹配组合"与"标记/篡改"两类拒绝的失败处理都来自生产 caller（`manager.acquire`/`manager.prepare` 与 `session` 的 catch 释放锁），不是测试自带判断；断言不修改 `portable-entry-guard.json`、不改生产代码、不预置标记来伪造持锁窗口。

### 测试驱动可靠性（R2）

驱动层不是被测断言的一部分，但它的失败路径必须可证，而且"保留现场"必须真的落到清理回调上：`fixture()` 把同一个 `cleanup` 既注册给 `t.after` 又返回给用例，用例在失败后**显式调用该回调**再断言根目录与哨兵文件仍在，而不是只断言 `t.after` 执行前目录还在。`driveChild()` 统一接管真实子进程与可控事件替身（`FakeChild`，可分别驱动 `close` 与两条流 `end`）：只有收到子进程 `READY`（钩子与生产模块导入完成）后才武装超时；超时与 READY 前超时走同一套"终止→有界等 `close`→有界等排空"逻辑，未确认时返回 `*_CLEANUP_BLOCKED` 并置 `guard.keep=true` 使 `t.after` 跳过删除。退出与排空分别记录：`childExited`、`streamsDrained`、`cleanupConfirmed` 三个字段各自独立，已确认退出但未排空记为 `childExited:true / streamsDrained:false / cleanupConfirmed:false`（保留目录、拒绝成功），不把已确认的退出改写成未知。普通 `close` 分支同样检查排空结果，未排空按 `CHILD_CLEANUP_UNCONFIRMED` 处理；`spawn` 的 `error` 在未启动时以 `CHILD_SPAWN_FAILED` 完成，启动后的运行期错误记录后待 `close` 收尾。回归用例：`real timeout after readiness exits the owned child before failing`（真实子进程 `hang` + 2s 期限）、`spawn failure settles as spawn failure without waiting for a deadline`、`confirmed exit without drained streams keeps the root through the real cleanup callback`、`unconfirmed child exit keeps the root through the real cleanup callback`、`readiness timeout terminates and waits for exit before failing`（替身 `kill()` 后异步 `exit()`，`childExited:true` 只能来自 `close` 路径）。

### 本批范围与未覆盖（不得外推）

- 仅覆盖 `createPortableNativeEntries` 这一组装路径的 guard 时序。`legacy-hermes-entry.mjs` 与 `launch-managed.mjs`/`managed-instance.mjs`（`beforeStart` 的 `checkEntryGuard`）属同一 guard 函数的其他 caller，本批未做动态覆盖，不得据本批写成"三处入口时序全覆盖"。
- 合成 adapter 不产生业务进程：不覆盖 Windows 原生 Job/进程树、CLI 键盘交互、真实 Dashboard、真实 P0 启动器调用链、同 home 模式切换与 U 盘验收。
- 仍未勾选：Windows 原生入口实机、真实实例锁路径上的并发行为、断线/异常回收与数据保留。

## P2-09-GUARD-CALLERS-06 剩余两类 caller 的持锁 guard 拒绝路径（`workbench/tests/legacy-managed-guard-order.test.mjs`）

本批只补 `managed` 与 `legacy` 两条入口在**持锁后进入 guard 的拒绝路径**，不覆盖成功启动。观测点：在隔离 Node 子进程中，动态 import 生产模块**之前**同时替换 `fs.promises.lstat`（按 `realpath` 后的完整路径限定）与 `node:child_process` 的 `spawn/spawnSync/exec/execSync/execFile/execFileSync/fork`（计数并立即抛 `PROCESS_SPAWN_BLOCKED`），并断言补丁对生产模块可见（`patched===true`）。任何业务进程一次都不会被创建；`spawnCalls` 恒为 0 是断言项而非推断。

| 案例 | 实际导入/调用 | 屏障命中 | 锁/owner 观测 | 拒绝与保留断言 | 平台 |
|---|---|---|---|---|---|
| managed 篡改启动器 | `startHermesInstance`（真实）→ `startManagedInstance` → `beforeStart` → 传入的真实 `assertPortableEntryGuard` | 生产 `beforeStart` 回调进入时（此时 `acquireInstanceLock` 已完成）改写 `<root>/launch.bat` | 进入回调时 `.p2-manager-lock/` 与 `owner.json` 均已存在 | `ENTRY_COORDINATION_UNCONFIRMED`；`spawnCalls=0`；篡改字节保留；本批锁已释放并可重获 | 跨平台（win32 之外的 `startProcess` 分支不参与，因 guard 先拒绝） |
| managed 恢复标记 | 同上 | 同一回调进入时写 `updates/hermes-restore-active.json`（与启动前的 `logs/diagnostics/p2-install-active.json` 前置检查区分） | 同上 | `INTERRUPTED_INSTALL_REQUIRES_RECOVERY`；`spawnCalls=0`；标记原文保留；锁释放可重获 | 跨平台 |
| managed 外部锁 | 同上，`acquireInstanceLock` 失败于 guard 之前 | 未进入 callback（`guardEntered=false`） | 不观测（未持锁） | `INSTANCE_LOCKED`；`spawnCalls=0`；外部 `owner.json` 原文不变；测试不调用生产 `release()` | 跨平台 |
| legacy CLI 篡改 | `launchLegacy(['--root',root,'--','--cli'])`（真实）→ `runLockedLegacyEntry` → `createNativeEntryManager` → 真实 `assertPortableEntryGuard` | `lstat(<root>/data)` 第 2 次命中（第 1 次为 manager 构造时的 `lstat(home)`），即持锁后 guard 首个文件系统调用 | 命中时锁与 owner 均在 | `ENTRY_COORDINATION_UNCONFIRMED`；`spawnCalls=0`；篡改字节保留；锁释放可重获 | Windows 原生（`portableWindowsOptions` 要求 win32，非 Windows 明确 skip，不伪装） |
| legacy dashboard 恢复标记 | `launchLegacy(['--root',root,'--','dashboard'])` | 同上第 2 次命中 | 同上 | `INTERRUPTED_INSTALL_REQUIRES_RECOVERY`；`spawnCalls=0`；标记保留；锁释放可重获 | Windows 原生 |
| legacy 外部锁 | `launchLegacy` + 预置 `.p2-manager-lock/owner.json` 外部字节 | 仅 manager 构造 1 次命中（guard 未进入） | 不观测 | `INSTANCE_LOCKED`；`spawnCalls=0`；owner 原文不变 | Windows 原生 |

`legacy` 夹具按 `portableWindowsOptions` 的真实格式在临时根合成（`manifests/runtime-components.windows-x64.json` + 对应 `ready.flag` 哈希 + `portable-location.txt` + `venv/Scripts/python.exe`、`git/bin/bash.exe`、`workbench/dist/index.html`、`src/hermes-agent/hermes_cli/main.py`），四份协调文件从固定源码复制，均明确为 synthetic；不执行启动器、不安装 runtime、不读 E 盘。

### 本批范围与未覆盖

- 只证明两条 caller 的**拒绝**路径在执行到 guard 时已持锁且不产生业务进程；`managed` 侧只到 `startHermesInstance→startManagedInstance→beforeStart`，**不**把 `launch-managed.mjs` 的组装（`parseLaunchArgs`/`portableWindowsOptions`/`inspectBaseline`）当作已动态执行；那条链的静态核对与真实启动器验收分开保留。
- 未覆盖：guard 通过后的成功启动、CLI 交互输入、真实 Dashboard 健康与打开、控制台 STOP、断线/进程树回收、真实启动器调用链与 U 盘验收。全部通过也不能写成"原生入口可用"。
- 本批未发现生产缺陷（两处实现按预期在持锁后调用 guard）；未修改任何生产代码、`portable-entry-guard.json` 或既有测试。

驱动层与 `portable-guard-order.test.mjs` R2 同一模式：`fixture()` 把同一个 `cleanup` 注册给 `t.after` 并返回给用例；各用例解构 `guard` 并传入 `runScenario→drive`，`drive()` 在 `cleanupConfirmed!==true` 时置 `guard.keep=true`，故 `t.after` 会真正跳过删除。子进程先输出 `READY` 才武装超时；超时、`READY` 前超时与运行期 `error` 都走"终止→有界等 `close`→有界等两条流排空"，未确认时返回 `*_CLEANUP_BLOCKED`；启动前 `error` 直接 `CHILD_SPAWN_FAILED`，启动后 `error` 记录后等 `close` 以 `CHILD_ERROR_RUNTIME` 收口。`childExited` / `streamsDrained` / `cleanupConfirmed` 分别记录，已确认退出但未排空记为 `childExited:true / streamsDrained:false / cleanupConfirmed:false`。五条可控事件夹具用例（`FakeChild`）覆盖两类收尾：退出/排空未确认的三项（永不发 `close`、超时后已退出但未排空、普通 `close` 未排空）在失败后**显式调用注册的 `cleanup()`** 并断言根目录与哨兵文件仍在；启动前 `error`（`CHILD_SPAWN_FAILED`）与启动后 `error`（`CHILD_ERROR_RUNTIME`，等 `close` 后）在确认可清理时**正常删除**临时根，并断言 `guard.keep=false`。

## P2-09-REAL-ACCEPTANCE-PREP-07 实机验收准备（方案，未执行）

### Lead 裁决：本章 T4 已冻结，不是可执行审批单

审阅对象为公司 `ddd039db70bcb59f28d619d8336180268ed0b226`。材料接收不代表执行批准。下文 T2/T4 保留准备过程，受本节覆盖；严禁按其顺序直接部署。

1. **当前确定冲突**：默认 setup 从 runtime 清单安装并校验 `29112bef099274229cadff79cdff7bf7b99c4b77`，P2 adapter 只接受 `28044757aabd34010bd9f5f3e3f82b0906b46241`。不得删掉 adapter 的 SHA 门禁、修改旧实例清单或 setup 后直接切换内核来绕过；旧 venv 和资产也不能因源码切换被视为匹配。
2. **开发设计选择**：首个实机候选只面向全新、独立、可丢弃的 Windows 测试根；保持 P2 已审接口固定 28044757，不把此次验收变成移植 29112bef 的另一项目。不改默认 P0 安装语义，不更新 E 盘现存实例。该选择只是开发设计，实验安装、网络下载和真实入口执行仍须总监批准。
3. **固定上游只读取证**：已读取 NousResearch/hermes-agent 的完整 Git tree `28044757aabd34010bd9f5f3e3f82b0906b46241`（API 返回相同 SHA、truncated=false）以及该提交的 pyproject.toml、package.json、web/package.json、web/vite.config.ts。Python 要求 `>=3.11,<3.14`；这关闭最低版本未知项，但不证明锁定 Python 下载可用或依赖安装成功。原生 Dashboard 是仓库根 npm workspace `web`，根目录有 package-lock.json；web 依赖 `file:../apps/shared`，不能只复制 web 子目录。web 的 build 为 `tsc -b && vite build`，产物目录 `hermes_cli/web_dist`。根 engines 要求 Node `^22.22.0 || ^24.11.0 || >=26.0.0`、npm `<11.10.0 || >=11.17.0`；不能仅按工作台自身 Node 下限放行。以上仅下载公开源码读取，没有运行上游命令。
4. **两类构建源码必须分开**：项目工作台来自固定 Hermes-USB-Portable 提交的完整 workbench 及 package-lock；原生 Dashboard 来自上述固定 Hermes 提交的完整 workspace 及根 lock。构建区、包输出、新测试根三者分离；P0 source-only 包不含 workbench，不能解包后直接在目标根执行工作台构建。两类资产都应在启动前构建、记录源码/依赖/产物身份，运行时禁止缺失后在线补构建。
5. **安装器设计边界**：还需 lead 实现或明确一个显式实验准备入口，先核对全部源码/版本/资产契约，再向全新测试根安装与 28044757 配套的独立 venv、受控 runtime 与资产；不先安装 29112bef 再覆写、不复用真实 home、不复制凭据、不修改默认 runtime manifest。实验契约若采用独立清单，须连同其 source identity、receipt 和 portable-layout 的验证关系一起设计，不能伪造 ready.flag。这部分目前未实现、未测试，不宣称完整安装链已具备。
6. **现有命令订正（仅语法，不授权执行）**：setup 的 Root 为必填，应写 `powershell -File <ROOT>/scripts/setup-windows.ps1 -Root <ROOT>`，但默认版本冲突未解决，仍禁止在本批候选根运行。P2 打包 CLI 要求两个参数：`node <REPO>/workbench/scripts/build-p2-package.mjs <REPO> <OUT>`，不是只传 OUT；安装器 PACKAGE 应为含 p2-package.json 的展开目录，不是 zip。Windows npm 入口需实际 npm.cmd 路径和版本核对，不能将 `<RUNTIME_NODE>/npm` 当成已核实命令。
7. **安全及失败处置**：实验根的删除也必须先确认本批进程全部退出且不含私人数据；“新目录”不自动授权递归删除。启动可能有初始化写入和非模型联网，未核实前不承诺仅安装阶段联网。停止操作须按实际入口核对，不能把控制器 STOP 文本发送到 CLI 对话输入；原生 CLI 键盘退出仍待验证。既有实例升级及成功安装后的回退继续冻结。

上游依据为固定 SHA 下的公开源码路径，不是当前最新版本文档；复核可按完整 SHA 读取。下一门禁是实验准备入口及隔离测试方案的 lead 实现/审查，不是立即让总监执行下文 15 步。

**本章只是待批准方案。** 本批未部署、未安装、未构建、未打包、未启动 Hermes/浏览器/服务、未读取真实 E 盘或个人配置；下列命令与步骤均未运行。历史 E 盘观察只作"未复核的历史信息"，不得当作现存状态或兼容依据。

### T1 版本与资产矩阵

| 项 | 要求 | 仓库依据 | 检查方式 |
|---|---|---|---|
| P0 外壳四文件 | `launch.bat`、`scripts/open-hermes.ps1`、`scripts/start-web-workbench.ps1`、`workbench/scripts/legacy-hermes-entry.mjs` 存在且按 LF 归一化后的 SHA-256 与 guard JSON 记录一致（schema 1、恰好 4 条） | `workbench/scripts/portable-entry-guard.mjs:20-32`、`portable-entry-guard.json` | 只读读取 JSON，逐文件重算哈希比对 |
| 固定 Hermes 内核 | 源码 HEAD == `28044757aabd34010bd9f5f3e3f82b0906b46241`，且 `git status --porcelain=v1 --untracked-files=no` 为空 | `native-entry-adapters.mjs:9,31-33`；`workbench/hermes-compatibility.json` 中该 commit `role=development`、`verified` 5 项、`not_verified` 含 `windows`/`chat-stream`/`approval`/`active-interrupt`/`reconnect`/`portable-lifecycle` | `node workbench/scripts/check-hermes-baseline.mjs <SOURCE> <GIT>`；注意 `release_ready=false`（同文件第 4 行）使 `release_qualified` 恒为 false、退出码 2，不能据此宣称发布合格 |
| 工作台构建产物 | `workbench/dist/index.html` 为文件；其余资源只允许 `package-policy.mjs:17` 的白名单后缀 | `launch-managed.mjs:35`、`build-p2-package.mjs:24` | `npm run build`（`tsc --noEmit && vite build`）后列目录核对 |
| 原生 Dashboard 资产 | 需 `source/hermes_cli/web_dist/` 目录且含 `index.html`（dashboard 分支），缺失即 `NATIVE_ASSET_INVALID` | `native-entry-adapters.mjs:36-37` | 目录与 `index.html` 存在性 |
| 运行时清单 | `manifests/runtime-components.windows-x64.json` 存在；`venv/../ready.flag` 内容 == sha256(manifest)；`portable-location.txt` == `realpath(root)`（大小写不敏感），否则 `RUN_SETUP_RELOCATION_REPAIR` | `portable-layout.mjs:25-28` | 只读重算哈希与路径比较 |
| venv/git 运行时 | `.cache/runtimes/windows-x64/venv/Scripts/python.exe`、`git/bin/bash.exe` 必须是文件 | `portable-layout.mjs:29-31` | 只读 `stat` |
| Node | `workbench/package.json` `engines.node = ">=22.12.0"`；开发机实测 v26.7.0 属本机记录而非目标机结论 | `workbench/package.json:6` | 目标机 `node -v` |
| Python | 运行时清单**锁定** `python 3.11.15+20260602`（python-build-standalone，带 sha256），由 `scripts/setup-windows.ps1` 安装；Hermes 内核自身的**最低版本要求不在本仓库声明**（`hermes-agent` 的 `pyproject.toml` 不在本仓）。两者必须分开写：锁定版本=已实现，最低要求=待核实 | `manifests/runtime-components.windows-x64.json`（`components[id=python]`）、`setup-windows.ps1:637` | 读清单核对 sha256；最低版本需在固定源码 `28044757` 的 `pyproject.toml` 核实 |
| P2 增量包 | 包内不含 P0 外壳；manifest `release_ready:false`、`status:"development-snapshot"` | `package-policy.mjs:1-15`、`build-p2-package.mjs:24,34` | 读 `p2-package.json` |

历史信息（未复核）：曾报告 E 盘为 P0 v0.21.0（`29112bef…`）且无 P2 原生脚本。`hermes-compatibility.json` 把 `29112bef` 标为 `bootstrap`、`not_verified:["p2-integration"]`，`f58fcc81` 标为 `historical-usb-observation`。三者都不能推断 E 盘当前可用性。

### T2 两种部署前提（按固定提交的实际脚本重写）

**更正**：此前写"仓库没有 P0 外壳生成及 runtime 安装脚本"是事实错误。固定提交里已有下列实现，必须与"尚未与 P2 组合验证"和"确实缺失"分开记录。

| 已有脚本 | 实际作用 | 依据 | 边界 |
|---|---|---|---|
| `scripts/build-p0-package.py` | 从 `git ls-files` 打 **source-only** P0 候选包 `Hermes-Portable-P0-RC2.zip`，生成 `package-manifest.json` 与 `.sha256` | L10-38 | 只含 `launch.bat`/`launch.sh`/`P0-Workbench.bat`/`README.md`/`.gitattributes`/`.gitignore` 及 `scripts`/`tests`/`manifests`/`docs`；**不含 runtime 与用户数据**；`.bat` 强制 CRLF |
| `scripts/install-p0-package.ps1` | 把 P0 外壳装进**已存在 `launch.bat` 的目标**；逐文件 SHA-256 校验、目标存在运行中可执行时拒绝、备份到 `logs/diagnostics/p0-package-backup-<guid>` 并写入 `restore-manifest.json`，失败回滚 | L9、L13-27、L29-34、L38-71 | 明确"Runtime, data and knowledge are not copied"（L36）——不建 runtime、不动 `data/` |
| `scripts/initialize-portable.ps1` | 布局初始化（`InitializerVersion 0.2.0`、`LayoutVersion 1`）：读 component lock、路径/链接/磁盘空间检查、写 `portable-ai.manifest.json` | L18-28 及 `Read-ComponentLock`/`Get-LinkLikePath`/`Get-DriveCheck` 等函数 | 只做布局与清单，不下载 runtime、不安装 P0/P2 包；**未见**引用 `setup-windows.ps1`/`install-p0/p2`（grep 无命中） |
| `scripts/setup-windows.ps1` | 读 `manifests/runtime-components.windows-x64.json`，`Invoke-WebRequest` 下载、`Get-FileHash` 校验（失败重下）、`Expand-Archive`，安装 portable Python 3.11，写 `ready.manifest`（含 `component_lock_sha256`）与分步 receipt | L80、L91、L116、L298、L315、L545、L577、L596-602、L637 | 运行时来源已实现；是否感知 P2 的协调文件与共享锁未核实 |

**组合状态（三层，不可混写）**

- **已有实现**：P0 源包打包、P0 外壳安装（含备份/回滚与运行中进程拒绝）、布局初始化、运行时下载与 sha256 完整性校验。
- **与固定 P2 尚未验证的组合**：上述四个脚本从未与 `portable-entry-guard.json` 固定的 P2 增量包一起执行；guard 要求 P0 四文件 LF 归一化哈希与 JSON 完全一致（`build-p0-package.py` 把 `.bat` 强制 CRLF，理论上归一化后一致，但未实测）；`initialize-portable.ps1` / `setup-windows.ps1` 产生的 `portable-ai.manifest.json`、`ready.manifest`、receipt 与 P2 guard/安装器没有组合测试覆盖。
- **确实缺失**：没有任何脚本把"P0 解包 → 布局初始化 → runtime → `npm ci` → P2 打包/安装"编排成一条链；`workbench` 的依赖安装（`npm ci`）不在任何仓库脚本内；"已成功安装但验收失败"的回退脚本不存在。

**A. 独立空测试目录（可行路径=已有脚本手工拼装，组合未验证）**

1. 解包 `Hermes-Portable-P0-RC2.zip` 到 `<ROOT>`（包内含 `launch.bat` 与 `scripts/`、`manifests/`）。
2. `powershell -File <ROOT>/scripts/initialize-portable.ps1 <ROOT>`（布局与清单）。
3. `powershell -File <ROOT>/scripts/setup-windows.ps1`（按清单下载并校验 python/node/uv/ripgrep/portablegit）。
4. 用 runtime 里的 Node 在 `workbench` 执行 `npm ci` 与 `npm run build`（**联网**，仓库无封装）。
5. `node workbench/scripts/build-p2-package.mjs <OUT>` → `node workbench/scripts/install-p2-package.mjs <PACKAGE> <ROOT> --verify` → `--apply-experimental`。

空目录必须**先**有 `launch.bat`：`install-p2-package.mjs:25` 在缺失时直接 `PORTABLE_TARGET_REQUIRED`，P2 包白名单不含启动器（`package-policy.mjs:1-15`）。`install-p0-package.ps1` 是"更新已有外壳"，不是空目录引导。

**B. 已有便携实例（就地升级）**

- 前提：`<target>/launch.bat` 存在；P0 安装器要求目标无运行中可执行；P2 安装器要求无 `logs/diagnostics/p2-install-active.json`、无活动 `.p2-manager-lock`；`data/` 不动。
- 步骤：构建工作台 → 打新包 → `--verify` → 外部手工备份 `data/` → `--apply-experimental` → 复跑 T1 矩阵 → 进入 T3。
- 回退：安装失败自动回滚；**已 apply 成功但验收失败**时无仓库脚本可用（`--recover-*` 仅在安装标记存在时有效）→ **待解决门禁；未明确前不申请就地升级**。

**备份与数据边界**：P0 → `logs/diagnostics/p0-package-backup-<guid>`；P2 → `logs/diagnostics/p2-package-<uuid>`；两者都只备份被替换的文件。`data/` 内是个人 `HERMES_HOME`、会话与配置，**不打包、不进 Git、不复制进证据**；升级前另行外部备份。

### T3 真实入口验收矩阵（未执行）

| 场景 | 实际入口 | 观察证据 | 失败即停条件 | 清理对象 | 模型费用 |
|---|---|---|---|---|---|
| CLI 交互与退出 | `launch.bat` → `:run_hermes` → `node workbench/scripts/legacy-hermes-entry.mjs --root <ROOT> -- --cli` | 独立控制台可输入、host 帧序列、进程结束后 `treeExited:true`、退出码原样返回（`LEGACY_EXIT_CODE_UNAVAILABLE` 例外） | 无控制台/输入无响应/`treeExited!==true`/锁未释放 | 输入 STOP 停止本批进程树；控制台窗口；**锁只能由持有者在确认整树退出后由生产代码释放，禁止手工删除 `.p2-manager-lock` 或 `owner.json`** | 0（不发消息时） |
| 原生 Dashboard 就绪/打开 | `scripts/start-web-workbench.ps1 -Root <ROOT>` → `legacy-hermes-entry.mjs -- dashboard` | 端口探测成功、`open()` 打开 `http://127.0.0.1:<port>/`、会话令牌仅在内存 | 探测失败/`DASHBOARD_NOT_READY`/打开后 4xx | 浏览器窗口、实例进程（显式 stop）；锁同上，不得手工清 | 0 |
| 同 home 互斥 | 同时启动 P2 托管入口与 CLI/Gateway | 第二方 `INSTANCE_LOCKED`、`owner.json` 原字节不变、无 PID 存活推断回收 | 双方同时持锁 / 出现自动回收 | 先启动方显式停止；不删除他人锁 | 0 |
| 显式停止与进程树退出 | STOP / 显式 stop 接口 | 子进程与后代全部退出、`treeExited:true` 后才释放锁；未确认记 `unknown` 并保留锁 | 锁提前释放 / 进程残留 | 仅终止本批持有句柄的自有进程（不全局 `taskkill`）；锁仍禁止手工删除 | 0 |
| 失败后禁止自动重试 | 制造启动失败（如临时撤销 `web_dist` 或占用端口） | 状态停在 `unknown`/`failed`，无自动重启、无重复 spawn 计数 | 出现自动重试 | 失败实例、保留的锁；由持有者显式 stop 后才释放 | 0 |
| 重启与数据保留 | 停止后重新启动，对比 `data/` 关键项 | 升级前已存在的配置/会话文件仍存在且逐文件 SHA-256 一致；新增会话、日志、receipt 属**预期变化**并逐项列出；安装标记为 0、无 `gateway.pid` 残留。**不要求整个 `data/` 哈希不变** | 既有文件缺失或被改写 / 出现未列出的预期外变化 | 对比副本（放实例外，不留在便携根） | 0 |
| 模型请求（可选） | 经 Dashboard 发送一条消息 | 真实响应与计费记录（如提供） | 未获批即不得执行 | 会话数据 | **需单独批准** |

**启动后的副作用（T3/T4 必须并列，不能只写"控制台/浏览器窗口"）**：① 本机回环监听 `127.0.0.1:<随机端口>`（Dashboard 分支）；② 写入 `data/`（会话、配置、日志）；③ 写入 `logs/` 与 `logs/diagnostics/` 的 receipt/证据；④ 创建并最终释放 `.p2-manager-lock/owner.json`；⑤ 启动浏览器进程与其临时目录；⑥ 若执行 `npm ci` 或 runtime 下载则有外网请求（仅 T4 步骤，不在启动路径）；⑦ 无模型调用时无外网模型请求。

**待核实（不得编造）**：`workbench/scripts/native-entry-host.py` 的 console 模式参数与 `windows-job-host.py` 子进程 `stdin=DEVNULL` 的差异未在本批核实，故 CLI 交互能力仍为"待验证"，不能据合成测试写"交互可用"。

### T4 一次性审批清单（待批准，不执行）

| # | 步骤 | 命令/手动 | 目标占位符 | 资源/时长 | 联网 | 文件副作用 | 备份/回退点 | 执行人 |
|---|---|---|---|---|---|---|---|---|
| 0 | 只读前置核对 | 重算四文件哈希、读 `p2-package.json`、`node -v` | `<ROOT>` `<SOURCE>` | <5 min | 否 | 无 | 无 | 授权执行人 |
| 1 | 解包 P0 源包 | 解压 `Hermes-Portable-P0-RC2.zip`（由 `build-p0-package.py` 产出） | `<ROOT>`（**必须为新目录**） | <1 min | 否 | 新建目录树 + `launch.bat` | 不覆盖现有实例 | 授权执行人 |
| 2 | 布局初始化 | `powershell -File <ROOT>/scripts/initialize-portable.ps1 <ROOT>` | `<ROOT>` | 1–2 min | 否 | 写 `portable-ai.manifest.json` 与布局目录 | 新目录失败可整个删除 | 授权执行人 |
| 3 | 运行时安装 | `powershell -File <ROOT>/scripts/setup-windows.ps1` | `<ROOT>` | 5–15 min | **是**（下载 python/node/uv/ripgrep/portablegit，按清单 sha256 校验） | 写 `.cache/runtimes/windows-x64/`、`ready.manifest`、receipt | 失败重下；新目录可删除重建 | 授权执行人 |
| 4 | 工作台依赖 | `<RUNTIME_NODE>/npm ci`（workbench） | `<WORKBENCH>` | 2–5 min | **是**（npm registry） | `node_modules/` | 失败不影响其他目录 | 授权执行人 |
| 5 | 构建工作台 | `npm run build` | `<WORKBENCH>` | 1–3 min | 否 | 覆盖 `workbench/dist/` | 先记录现 dist 清单与哈希 | 授权执行人 |
| 6 | 打 P2 包 | `node workbench/scripts/build-p2-package.mjs <OUT>` | `<OUT>` 新目录 | <1 min | 否 | 新建目录 + `zip` 归档 | 输出必须为新目录，不覆盖 | 授权执行人 |
| 7 | 校验安装 | `node workbench/scripts/install-p2-package.mjs <PACKAGE> <ROOT> --verify` | `<PACKAGE>` `<ROOT>` | <1 min | 否 | 无（只读） | 无 | 授权执行人 |
| 8 | 备份数据 | 手动复制 `data/` 到实例外备份位 | `<BACKUP>` | 取决体积 | 否 | 新建备份 | 备份后再 apply | 用户/授权执行人 |
| 9 | 应用增量包 | `node workbench/scripts/install-p2-package.mjs <PACKAGE> <ROOT> --apply-experimental` | `<ROOT>` | 1–2 min | 否 | 覆盖包内文件 + `logs/diagnostics/p2-package-<uuid>/` | 失败自动回滚；不确定则保留标记 | 授权执行人 |
| 10 | 复核矩阵 | 重跑 T1 检查 | `<ROOT>` | <5 min | 否 | 无 | 失败即停 | 授权执行人 |
| 11 | CLI 验收 | T3 第 1 行 | `<ROOT>` | 5–10 min | 否 | 控制台窗口、`data/` 会话与日志、锁 | 输入 STOP | 用户（需键盘交互） |
| 12 | Dashboard 验收 | T3 第 2 行 | `<ROOT>` | 5–10 min | 否 | 回环监听、浏览器窗口、`data/` 写入、锁 | 显式停止 | 用户 |
| 13 | 互斥/停止/回收 | T3 第 3–5 行 | `<ROOT>` | 10–15 min | 否 | 进程与锁 | 逐项显式停止，不手工清锁 | 用户 + 授权执行人 |
| 14 | 数据保留复核 | T3 第 6 行 | `<ROOT>` | 5 min | 否 | 实例外对比副本 | 用第 8 步备份恢复 | 授权执行人 |

预计总时长 45–90 分钟；联网仅第 3、4 步（runtime 下载与 npm registry）；除"模型请求"一项外无模型费用。**就地升级（B 方案）在回退门禁明确前不申请**；执行前需用户批准，employee 不执行实机步骤。

### 本批未知项与缺口（不得当作已解决）

1. **Hermes 内核最低 Python 版本**：本仓库只锁定运行时 `3.11.15+20260602`，最低要求须读固定源码 `28044757` 的 `pyproject.toml`（不在本仓），未核实。
2. **P0 四脚本与固定 P2 的组合未验证**：`build-p0-package.py` 强制 `.bat` CRLF、guard 归一化 LF 后比对，理论一致但未实测；`portable-ai.manifest.json`、`ready.manifest`、setup receipt 与 P2 guard/安装器无组合覆盖。
3. **`npm ci` 无仓库封装**：依赖来源与 registry 可达性未验证；本批未执行。
4. **"已 apply 成功但验收失败"的回退流程未解决**（`--recover-*` 仅覆盖有安装标记场景）→ 不申请就地升级。
5. **CLI 控制台输入可用性**：`native-entry-host.py` console 模式未核实。
6. **历史 E 盘状态与内核版本**（`29112bef`/v0.21.0）未重新核验，不得当作现存或兼容依据。


