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
- 测试稳定化（P2-CLI-BASELINE-04 返工3）：
  - Test 1 子进程打印 PID 后轮询等待信号文件 `go.txt`（30s 超时），测试取得全部 OpenProcess 句柄后创建该文件释放子进程
  - 子进程收到 `go.txt` 后创建 `done.txt` 作为独立退出许可证据；测试在验证孙进程回收前检查 `done.txt` 存在，区分正常退出和超时退出
  - Test 1b 用 `lines.get(timeout=15)` 等待子进程 PID 输出替代 `time.sleep(1)`
  - stderr 从 `stderr_buf` 获取实际输出，不再为空字符串
  - 多行 Python 代码用 `\n` 分隔替代单行分号语法
  - reader 线程（stdout/stderr）在关闭流前 `join(timeout=5)` 确认回收
  - 异常路径清理顺序：kill host → 等待退出 → 清理句柄 → join readers → 关闭流 → 删除信号文件和临时目录
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
