# P2 后端生命周期实现记录

## 已实现的基础

`workbench/scripts/owned-process.mjs` 使用 spawn 子进程句柄建立所有权，不接受持久化 PID 来停止进程。
调用者必须提供绝对可执行路径、绝对 cwd、明确环境、参数数组和健康探针；不启动 shell。
目前状态为 starting、ready、stopping、stopped、exited。

- 识别 BACKEND/DASHBOARD ready 行后仍等待探针返回 true，不以打印端口替代认证握手。
- 启动总超时包含探针耗时，超时停止本次子进程；迟到探针不能把已停止状态改回 ready。
- 停止只发往本次 child handle，先 SIGTERM，等待窗口结束后 SIGKILL；以退出事件确认结束。
- 原始 stdout/stderr 不保存或输出，避免把可能含密钥、模型消息的诊断混入普通日志。
- stderr 持续排空；启动行缓冲有上限，失败仅暴露固定错误分类。

调用者必须消费 ready 的拒绝并等待 stop 完成。健康探针应实现自己的资源清理，不能保留无限连接。

## 单实例锁增量

`instance-lock.mjs` 在调用者指定的真实运行目录下原子创建 `.p2-manager-lock`。
已有目录一律拒绝二次获取；不依据 PID 不存在、时间过期或换电脑自动抢占。
归属记录含随机 nonce、PID 和创建时间，不含服务认证令牌。释放时核对目录身份与归属原文，
只删除自身 owner.json 和空锁目录，不递归删除未知文件。

`managed-instance.mjs` 将锁与子进程句柄绑定：先持锁再启动；仅在子进程退出后释放锁。
参数错误也释放本次锁。Linux 测试覆盖同进程并发与独立进程排他、锁归属变化、未知内容保留，
以及停止后再次启动。它是协作式锁，不是针对恶意本地进程并发篡改文件系统的安全边界。
崩溃遗留锁需要后续明确恢复流程，目前宁可拒绝启动，也不误接管其他服务。

## Hermes 装配与隔离实测

`hermes-instance.mjs` 接受明确 python/source/home/environment，不搜索个人安装或默认继承环境。
固定启动 `serve --isolated --host 127.0.0.1 --port 0`，32 字节随机认证令牌只通过子进程环境传入，
连接信息只在内存返回。保留 venv Python 路径，不把它的符号链接解析成基础解释器。
源码根目录若含 `.env` 则拒绝，等待配置范围核对；数据目录必须预先存在。
这不是操作系统沙箱，普通调用仍可读取指定 home 配置并使用调用者传入的环境。

`hermes-health.mjs` 使用 WebSocket 认证握手，收到 gateway.ready 后发送无副作用的未知方法，
要求匹配 ID 的 -32601 响应。只看到端口或 socket open 不算健康。超时、abort、错误均关闭探针连接，
不打印原始服务错误或认证令牌；停止管理器也会取消在途探针。

2026-09-08，在既有开发源码上运行：

```sh
bash workbench/scripts/probe-managed-isolated.sh /home/zgj/.hermes/hermes-agent
```

Linux bwrap 隐藏宿主 home/tmp/run、源码只读、清空环境、隔离外网，使用临时空数据目录。
真实 Hermes 子进程最终退出码 0，证据为：

```json
{"authenticatedHealth":true,"rejectsWrongToken":true,"singleInstance":true,"stopped":true,"lockReleased":true}
```

没有创建会话、发送模型请求或调用工具。以上是开发机受测源码的真实管理器集成证据，
不覆盖 Windows、目标 U 盘提交、网页启动入口或用户已有数据迁移。

## 尚未完成，不能作为发布启动器

### Windows 进程树包装器（尚未原生验收）

`windows-job-host.py` 在创建 Hermes 子进程前，将自己加入匿名 Job Object，设置
KILL_ON_JOB_CLOSE，不允许 breakaway，句柄不继承给子进程。Windows 启动装配现已使用这个包装器。
建立约束失败时不会启动 Hermes，也不退回按名称/PID 批量结束进程的方式。
父进程退出时由系统关闭句柄并处理同 Job 子孙进程；这是资源清理，不是任务回滚或优雅终止保证。
管理器与包装器之间另保留 stdin 所有权管道；管理器异常退出造成 EOF 时包装器退出，
触发 Job 清理。不能仅依赖隐藏窗口收到 Ctrl+C。此父进程异常路径仍待 Windows 原生测试。

`portable-layout.mjs` 已增加 Windows 运行目录装配：核对 ready.flag 与组件锁哈希、
portable-location.txt 与当前路径，缺失或迁移未修复时拒绝继续。为本实例设置 Python、Git Bash、
Node、uv、APPDATA/LOCALAPPDATA 等路径，不继承宿主 API Key、PYTHONHOME/PYTHONPATH 或旧 PATH。
模型配置仍由明确的 data 目录加载；这不是模型凭据迁移工具。不自动下载组件或修改用户配置。
环境构造已通过 Linux 上的 Windows 路径单元测试，文件检查入口仍待原生 Windows 验收。

设计依据：[Microsoft Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)
和 [AssignProcessToJobObject](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject)。
Job 成员创建的子进程默认继承关联；最后一个带 kill-on-close 的 Job 句柄关闭会终止其成员。
宿主已有 Job 的限制可能令分配失败，应保持失败关闭，不能为验收要求管理员权限来绕过。

本轮只在 Linux 做语法检查，不能据此宣布 Windows 可用。后续用 Windows portable Python 执行
`workbench/tests/test_windows_job_host.py`：它只启动短时休眠的测试子孙进程，验证终止包装器后两者退出。
测试清理只针对自身捕获的进程句柄。Linux 运行此测试必须显示 skipped，不可计入 Windows 通过数量。

### 本机网页控制接口增量

`control-server.mjs` 只监听 127.0.0.1 的随机端口，提供静态构建资源以及管理 API。
每次启动生成独立控制令牌，所有 API 要求 Bearer 认证；Host 必须匹配监听地址，
带 Origin 的请求必须同源，POST 还要求明确同源 Origin。GET 可以不带 Origin（浏览器同源 GET 的正常行为），
但仍必须认证。没有 CORS 放行。

- GET `/api/status` 只返回管理状态；GET `/api/connection` 仅在 ready 时返回内存连接信息。
- POST `/api/start`、`/api/stop` 不接受请求体，不转发任意命令、路径或环境变量。
- 并发操作返回 409；启动异常保留已有实例句柄供停止，不自动再次启动。
- 关闭控制器等待本次操作结束，再停止其持有实例；未使用全局 Hermes 停止命令。
- 静态资源通过 realpath 限制在构建目录中，阻止跨目录符号链接；设置 no-store、no-referrer 和 CSP。

接口测试使用 Node 假实例和本机 HTTP，证明授权拒绝、并发拒绝、令牌不进入静态页/状态页、
目录边界和关闭等待行为。不等于真实服务网页集成或 Windows 验收。

实验页现已使用这些接口：`ServiceControls` 手动输入管理令牌后先读取状态，idle 才可启动，
ready 可连接；停止需要勾选明确确认。获取连接信息后交给现有 WebSocket 聊天通道。
控制令牌仅存在组件内存，离页清空；输入框在首次请求后清空，不写浏览器存储。
请求使用同源固定路径、不携带 cookies、不接受重定向、没有任意命令请求体。
75 秒观察超时不会证明服务停止；页面转为未知并要求先查状态，不自动重试。
普通 Vite 预览不提供管理 API，这些按钮不能据此启动服务。
本增量仅完成请求单元测试和前端构建，页面与管理服务器的浏览器整合待测。

### 管理 HTTP → 真实 Hermes 集成增量

同一隔离脚本现已再通过控制 HTTP 接口启动真实 Hermes，使用其返回的临时连接信息完成
WebSocket Origin 检查，然后经 `/api/stop` 停止。2026-09-08 退出码 0，新增检查全部为 true：

```json
{"controlUnauthorizedRejected":true,"controlStartReady":true,"localOriginAccepted":true,"foreignOriginRejected":true,"controlStopIdle":true,"controlLockReleased":true}
```

Origin 探针使用 Python WebSocket 客户端显式发送管理网页的本机 Origin，模拟浏览器跨端口请求；
不是实际浏览器点击证据。未放宽上游 Origin 或认证检查，没有自动读取个人令牌、创建会话或调用工具。
控制接口与真实进程链路已验证，页面交互与这条链路合并的最终浏览器验收仍待做。

1. 具体 Hermes 命令装配已完成并隔离实测；前端认证引导和便携环境装配尚未完成。
2. 跨进程单实例锁已实现基础；宿主崩溃后的诊断恢复与 Windows 文件系统验收尚未完成。
3. Windows Job Object 包装器已实现，原生进程树清理、受限宿主和退出时序仍待实测。
4. 停止后的工作副作用不会自动回滚；不能将 stop 成功解释为任务恢复成功。
5. 网页认证停止接口与按钮已接入；实际浏览器联调、安全退出及 Windows 验收尚未完成。

因此 P2-04 保持未完成。测试启动的是短生命周期 Node 假服务，没有停止个人 Hermes 服务。
