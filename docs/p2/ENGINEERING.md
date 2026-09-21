# P2 工程手册

本文件收拢内核基线、协议、配置、服务与实验启动说明。**它不是进度清单。**
当前状态见 [PROGRESS-GUIDE](PROGRESS-GUIDE.md)，测试事实见 [VALIDATION](VALIDATION.md)。

下面各节保留原始调查与逐批实现记录，包含当时的“尚未完成”描述，按记录日期理解；
不把 2026-09-08 的观察外推到当前上游版本、另一提交或新电脑。
涉及个人源码路径的旧命令仅是历史记录，不构成再次访问/联调个人实例的授权。
新增/变化接口必须对照当前代码重新核实。2026-09-21 已整合 dff159b 与 190cc89 到唯一开发分支。

## 关键边界速查

- 工作台管理 HTTP 与 Hermes HTTP/WebSocket 是两个服务、不同端口及令牌。
  管理目录/准备接口走管理服务；聊天和历史正文走相应 Hermes 实例，不能混用。
- /api/ws 和 GET /api/sessions/{id}/messages 属已调查 Hermes 基线，不是本仓库应重复建设的后端。
  dff159b 旧进度文档将其记为“未实现”不准确；目标版本的兼容性仍需验证。
- /api/capabilities/evidence 是外部提交拟用的适配接口，当前管理服务没有对应实现。
- 整合保留 prepare-capability.mjs 与 capability-run.ts 的管理服务准备/重核方案；
  构建错误已修复，但浏览器与真实实例链路仍需复验，不能改回只信任缓存指纹。
- 令牌不进入持久存储/日志；配置列表读取须 include_sessions:false；
  command.dispatch 可能执行快捷命令/插件，不能当只读预览。
- /learn 使用经指纹核对的纯提示构造器，提示词本身不是文件权限边界。
- 仅读历史不等于恢复；resume 可能继续执行。未知运行/工具状态不能写死安全。
- 包、安装恢复和发布门禁仍由实际脚本/兼容清单控制；文档整理没有解除门禁。

## 索引

- [设计与页面入口](#design)
- [基线与发布资格](#baseline)
- [协议与隔离调查](#protocol)
- [配置与 Skill 接口](#interfaces)
- [服务所有权与停止](#lifecycle)
- [实验启动与安装恢复](#launch)

<a id="design"></a>

## 设计与页面入口

六屏原型映射保留如下，视觉校准仍未验收。样式参考在 workbench/resources/style-guide.json，
实现样式在 workbench/src/styles.css；原始 Stitch HTML/截图若未随仓库提供，先核对现有资源，
再明确申请补齐，不把缺原始资产误写成所有设计资料不存在。

| Stitch 页面 | 前端路径与边界 |
|---|---|
| 工作台首页 | /，展示状态需核对真实数据来源 |
| AI 智能助手对话 | /chat 为演示，真实实验入口 /chat/live |
| 任务执行进度中心 | /tasks 为当前连接事件，/tasks/demo 为模拟 |
| Skills 管理中心 | /skills，完整管理接口尚未交付 |
| 本地资源仓库 | /repository，不表示已实现任意文件操作 |
| 首次启动初始化向导 | /onboarding，不能把页面存在当初始化已验收 |

/capabilities 提供草稿与能力入口，/settings 的更新不能伪装已接入。
默认首页/聊天路由在统一基线后应重新核对，未接线处须清楚标注模拟/不可用。


<a id="baseline"></a>

## 基线与发布资格

2026-09-08 开发机 HEAD：`28044757aabd34010bd9f5f3e3f82b0906b46241`，
`git status --porcelain --untracked-files=no` 为空。该检查只证明已跟踪源码未修改，
不审计未跟踪文件、第三方依赖或用户配置。

bootstrap：`29112bef099274229cadff79cdff7bf7b99c4b77`。
两提交的 `web_server.py`、`tui_gateway/server.py` 有实际差异；即使
`desktop_contract` 都为 6，也不足以证明完整兼容。

U 盘历史记录：`f58fcc8118d9db092ad60d363d4a28520e08ac5a`，
当前本机 Git 对象库没有该提交，U 盘未连接，因此没有核实其当前内容。
不能声称它损坏或不兼容，也不能直接当作已通过。

#### 机器可读清单与预检

`workbench/hermes-compatibility.json` 分别记录三种基线和已验证能力。
`release_ready:false` 表示尚未达到发布验收，不意味着禁止继续隔离开发。

在 workbench 目录运行：

```text
node scripts/check-hermes-baseline.mjs ABSOLUTE_HERMES_SOURCE [GIT_EXECUTABLE]
```

仅执行 Git 读取，不 fetch、checkout、安装、删除或更新内核。可传入便携 git.exe 路径。
退出码：0 为清单认定的完整发布资格；2 为识别成功但尚未满足发布资格；1 为检查失败。
当前所有已知基线都应返回 2，不能为了打包将清单改成无证据的通过状态。

开发机检查结果：known-baseline-partial、tracked_changes:false、release_qualified:false。
后续集中测试包必须携带该清单并明确所需内核，不能自动升级用户 U 盘以掩盖不匹配。

<a id="protocol"></a>

## 协议与隔离调查

#### 调查范围（2026-09-08）

本轮只读检查开发机现有 Hermes 源码，HEAD 为
`28044757aabd34010bd9f5f3e3f82b0906b46241`。这不等同于用户 U 盘上的
`f58fcc8118d9db092ad60d363d4a28520e08ac5a`，也不等同于 bootstrap 锁定提交。
已完成下述隔离服务握手探测，但未发送真实会话请求，不能将本调查标记为 P2-03 全部完成。

#### 已看到的接口形状

- `tui_gateway/ws.py`：`/api/ws` WebSocket 传输调用统一 dispatch；连接接受后发送
  JSON-RPC 2.0 `method: event`，`params.type: gateway.ready`。
- ready 的 payload 包含 `replay_epoch`、heartbeat 等能力；不能把这些能力当作稳定的全协议版本号。
- 当前发送实现逐条 `send_text`，接收实现对一个文本帧 `json.loads`。
  客户端应逐个发送请求对象；不能假设服务支持 JSON-RPC 批量数组。
- `tui_gateway/server.py`：请求 ID 关联结果或错误，长任务可异步返回；消息流中的事件与响应必须分流。
- `tui_gateway/methods_session.py`：`session.interrupt` 使用 session_id，可返回 interrupted、
  not_interrupted 或错误。发送取消请求不等于已停止，停止也不等于恢复副作用。
- `hermes_cli/web_server.py` 存在认证、Host/Origin 和会话令牌检查。不能因监听 localhost 就绕过认证，
  也不能把令牌写入前端源码、持久存储或普通诊断日志。

#### 当前前端基础

`src/domain/rpc.ts` 只做报文封装与解码，不打开连接。结果、错误、事件分开处理；
payload 保持 unknown，后续按具体方法验证。无效 JSON、错误 ID/sequence、矛盾结果和超限文本报文会被拒绝。
支持换行分隔输入是解码器能力，不是已经证明上游将事件合并成一个 WebSocket 帧。

同文件中的 `RpcChannel` 负责一个传输生命周期的请求关联：乱序结果按 ID 匹配，
超时删除等待项，迟到/重复结果不会完成其他请求。断线、发送异常和损坏报文会拒绝
所有等待请求，关闭后不重发。重连必须创建新通道并另外确认服务与会话状态。
每通道最多 128 个等待请求；错误只传递分类和代码，不直接将上游错误正文展示给用户。
这些能力已使用假传输测试，尚未连接真实 WebSocket，也未实现认证或自动重连。

`connectHermes` 已增加浏览器 WebSocket 适配：只允许 `ws://127.0.0.1/.../api/ws`
（实际路径必须恰为 `/api/ws`），socket open 不代表就绪，必须收到 `gateway.ready`。
握手超时、损坏报文与断线会清理监听和等待项；主动关闭幂等，不自动重试或重发。
该适配已接入真实连接实验页，但页面与真实服务的整合尚未验收；认证引导、服务进程所有权和恢复仍待实现。

#### 下一道门槛

1. 在明确隔离的 HERMES_HOME 下启动与目标匹配的源码，不借用个人会话或自动读取模型密钥。
2. 验证实际认证引导、ready、健康检查及不支持方法的错误；记录源码提交及受测能力。
3. 核实 session.create、prompt.submit、message.delta、工具/审批事件的字段，再接入 UI。
4. 请求超时清理等待项；断线后不自动重发有副作用的请求。先恢复身份、epoch 与事件序号再恢复显示。
5. 验证取消确认、失败、拒绝授权、服务重启、单实例与安全停止；不得以关闭浏览器代替停止后端。

未经这些门槛，界面继续明确标记模拟，不显示真实已连接或已授权。

#### 隔离握手证据

开发机执行 `bash workbench/scripts/probe-hermes-isolated.sh /home/zgj/.hermes/hermes-agent`。
脚本需要 Linux 的 bwrap 和已有源码/venv；不是 Windows 用户安装命令。
隐藏宿主 home、tmp、run，源码只读，清空继承环境，使用临时 HERMES_HOME 和私有网络命名空间。
无外网，令牌只在探针与其子进程内存中产生和使用，不写入输出。
运行前拒绝源码根目录含 `.env` 的情况。这个探针不是用于运行不可信源码的通用沙箱。

2026-09-08 最终运行结果：

```json
{"unauthenticated_rejected":true,"gateway_ready":true,"unknown_method_error_code":-32601,"started":true}
```

进程退出码 0，探针结束时停止自己启动的服务，命名空间随之释放；没有使用全局 `serve --stop`。
本次未创建会话、调用工具、发送模型请求或复制个人凭据。
发现并处理了 `HERMES_BACKEND_READY` 启动标记和 WebSocket 库异常类型的版本差异。
此证据只覆盖上述开发机提交；U 盘目标提交的兼容性、聊天流、审批、取消及重连仍待验证。

#### 空会话生命周期增量

同一隔离探针现已加入一个空会话的创建/关闭，不提交 prompt。
最新退出码 0，除握手检查外得到：

```json
{"session_created":true,"desktop_contract":6,"session_cwd_isolated":true,"session_closed":true,"stale_interrupt_error_code":4001,"duplicate_close_false":true}
```

runtime session_id 与 stored_session_id 不同用途，恢复会话时不能混用。
关闭后 interrupt 返回 4001（会话不存在），不是取消成功；重复 close 返回 closed:false。
前端新增对应形状解码。正常 interrupt 的 acknowledged 只代表服务确认请求，
不代表工作线程已经结束，更不代表副作用已回滚；正常运行中取消仍待后续测试。
本探针的空会话可能初始化 agent，但隔离网络不可访问外网，且未提交模型任务或执行工具。

#### 流式文本投影

源码 `server.py` 的 `_stream` 发出 `message.delta`，文本字段为 `payload.text`；
最终 `message.complete` 携带完整文本及 `complete/error/interrupted` 状态，不是 `success`。
`src/domain/chat-events.ts` 据此实现单轮文本投影：增量追加、最终文本替换、按 session_id 隔离、
忽略重复/倒序序号、终态不被迟到片段覆盖，并限制显示缓冲长度。
这里只处理纯文本，不执行 rendered/HTML 字段。测试为合成事件，不等同于模型流实测。
尚未处理 interim、压缩、会话恢复及缺失序号的重放，不能据此开启自动恢复。

#### 缺失模型配置的真实失败事件

隔离探针新增 `prompt.submit`：环境无外网和真实模型凭据，发送固定测试句，不复制用户消息。
2026-09-08 实测 `prompt_failure_observed:true`、`terminal_error_event:true`、
`tool_not_started:true`，其余握手和会话生命周期检查仍通过，进程退出码 0。
这证明该受测提交在本场景会产生 `message.complete` / `status:error`，
并非只返回提交请求的响应。前端必须继续消费事件，不能因 submit 返回便停止等待。
未验证成功模型回复或真实工具审批；本测试不产生外部模型费用。

#### 单次审批答复增量

只读核对 `tui_gateway/server.py::_approval_request_payload` 和
`tui_gateway/methods_prompt.py` 的 `approval.respond`：事件提供 request_id、command、choices；
答复使用 runtime session_id、request_id、choice 和 all:false，结果为 resolved。
前端只展示服务允许的 once/deny，未知或缺失关键字段不允许授权；多个请求依次展示。
命令及原因是服务提供的信息，不代表前端已独立验证安全性。答复超时或 resolved 非 true 时
进入结果未知状态，不自动再次批准。收到答复确认不代表命令已执行成功或可回滚。
当前覆盖单元测试与构建，真实工具审批、重连后的待审批恢复仍未验证。

<a id="interfaces"></a>

## 配置与 Skill 接口

2026-09-09 只读源码调查：开发机 Hermes 提交 `28044757aabd34010bd9f5f3e3f82b0906b46241`。
此表不是接口稳定性或目标 U 盘兼容性承诺；未调用个人配置、学习或安装接口。

| 用途 | 源码接口 | 当前认识与接入边界 | 状态 |
|---|---|---|---|
| 可用 Skills | methods_tools.py: skills.manage，action:list | 返回 skills 分类→名称数组；banner.get_available_skills 按平台/禁用状态过滤且有进程缓存。空列表也可能源于上游扫描失败，不代表未安装 | 已接只读实验 UI；解码测试通过，真实整合未测 |
| Skill 搜索/安装 | skills.manage 的其他 action | 搜索可能联网；安装有写入与供应链风险，不能将通用 action 直接暴露给任意 UI 参数 | 待完整盘点与确认式适配 |
| 内置命令识别 | command.resolve、commands.catalog | 可发现名称与元数据，但不证明 dispatch 的执行对象没有被覆盖 | 待独立解码与隔离探针 |
| /learn | 指纹锁定的 agent/learn_prompt.py 纯构造器 → 确认后 prompt.submit | 不调用 command.dispatch；未知构造器拒绝。提示生成和轮次结束均不表示 Skill 已写入或验证 | 已接准备、审阅、确认提交；实际产出待验 |
| Skill/Bundle 调用 | command.dispatch | Skill 返回 type:skill，Bundle 返回 type:send；message 是模型上下文，不作普通回复展示。Bundle 缺成员可能跳过，不能假报完整方法可用 | 待验证成员完整性与调用语义 |
| 历史会话 | session.list / session.resume | list 已接；resume 返回 resumed、messages、running、inflight 等，与 create 结构不同，且可能 auto_continue | 恢复待接入，不能套用 create 解码器 |
| 历史正文只读查看 | GET /api/sessions/{id}/messages | 采用 limit:50、offset:0、order:latest；上游只读 DB，可能解析压缩后的 ID，不创建运行会话。仅投影用户/助手纯文本及 display_content，丢弃工具/隐藏消息 | 已接 UI 和隔离 HTTP 探针；浏览器及 Windows 待验 |
| Profile | methods_profiles.py: profiles.list/describe/configure 等 | list 明确 include_sessions:false，仅投影名称、显示名、默认标志、模型、提供方和技能数量；null 模型/提供方显示未配置。Profile 不直接等同于自定义 Agent | 列表已接实验 UI 和隔离探针；选择/describe/configure 待接入 |
| MCP 列表 | mcp.servers.list | 摘要仍可能含 URL、命令和参数；UI 需最小字段投影，不直接输出完整返回值 | 待字段审计/解码 |

#### 已发现的执行风险

Profile 增量核对：`profiles.list` 的 include_sessions 默认 true；其 canonical session 分支
可能通过 `_resurrect_recoverable_canonical` 恢复归档记录。因此配置列表必须显式 false，
不把默认请求当成纯枚举。UI 不保留 path、description、ui_meta 或会话摘要，也不自动轮询。
用户主动读取时，服务可能枚举同一安装下的其他 Profile，页面已说明这个范围。
Linux 隔离探针确认 profiles_list_shape、profiles_exclude_sessions 为 true，未观察到 tool.start。
首次探针因 null 模型字段失败，按 `_read_config_model` 的真实返回语义修正后复跑退出码 0。
这不证明个人配置多 Profile、Windows 或配置切换已验证。

增量实测：Linux bwrap 隔离实例的 skills.manage(action:list) 返回分类/名称形状通过，
command.resolve(name:learn) 返回 canonical:learn，期间未观察到 tool.start，探针退出码 0。
不涉及 command.dispatch、Skill 生成或安装，不证明学习命令执行安全、完整目录或 Windows 行为。

`command.dispatch` 在内置 learn 分支之前处理 quick_commands 与插件。
同名快捷命令可能执行 shell，因此调用 dispatch 不是只读“预览提示”，即使事后只接受 send
类型也无法撤销已经发生的副作用。接通前必须验证配置边界与目标版本的实际行为，
并将整个分发操作纳入用户明确确认；不得用它做自动能力探测。

P2-12 为部分进行中：已定位主要入口，仍需完整字段盘点和隔离服务验证。
P2-13 已完成可用 Skill 快照和 Profile 摘要读取接线，尚未选择配置或调用 Skill。
P2-18 已接学习请求准备与确认提交，Agent/Skill 内容配置仍归 Hermes，不在开发机提前生成真实技能。

2026-09-11：管理器新增认证 GET `/api/capabilities/catalog`，仅使用启动时固定的 home/skills，
浏览器不能指定扫描目录。按完整 Skill 子树计算 `hermes-skill-tree-v1` SHA256，输出草稿定义，
不返回正文、不加载 Hermes/Python、不写 Skill。拒绝链接、大小写碰撞和超限；最多 5000 项、
100 个定义、单文件 1 MiB、总读取 16 MiB、草稿 JSON 64 KiB。不是 Hermes 可用性清单，
不判断禁用状态、平台或依赖，也不包括外部/项目 Skill 或 Bundle。快照不是执行授权，
真实调用前仍须重新检查指纹。目录变化可能使扫描失败，不能据此自动删除或修复用户文件。
实验聊天页的实例管理区域可导出草稿，再到能力卡片页导入；暂无自动同步或发布。

<a id="lifecycle"></a>

## 服务所有权与停止

#### 已实现的基础

`workbench/scripts/owned-process.mjs` 使用 spawn 子进程句柄建立所有权，不接受持久化 PID 来停止进程。
调用者必须提供绝对可执行路径、绝对 cwd、明确环境、参数数组和健康探针；不启动 shell。
目前状态为 starting、ready、stopping、stopped、exited。

- 识别 BACKEND/DASHBOARD ready 行后仍等待探针返回 true，不以打印端口替代认证握手。
- 启动总超时包含探针耗时，超时停止本次子进程；迟到探针不能把已停止状态改回 ready。
- 停止只发往本次 child handle，先 SIGTERM，等待窗口结束后 SIGKILL；以退出事件确认结束。
- 原始 stdout/stderr 不保存或输出，避免把可能含密钥、模型消息的诊断混入普通日志。
- stderr 持续排空；启动行缓冲有上限，失败仅暴露固定错误分类。

调用者必须消费 ready 的拒绝并等待 stop 完成。健康探针应实现自己的资源清理，不能保留无限连接。

#### 单实例锁增量

`instance-lock.mjs` 在调用者指定的真实运行目录下原子创建 `.p2-manager-lock`。
已有目录一律拒绝二次获取；不依据 PID 不存在、时间过期或换电脑自动抢占。
归属记录含随机 nonce、PID 和创建时间，不含服务认证令牌。释放时核对目录身份与归属原文，
只删除自身 owner.json 和空锁目录，不递归删除未知文件。

`managed-instance.mjs` 将锁与子进程句柄绑定：先持锁再启动；仅在子进程退出后释放锁。
参数错误也释放本次锁。Linux 测试覆盖同进程并发与独立进程排他、锁归属变化、未知内容保留，
以及停止后再次启动。它是协作式锁，不是针对恶意本地进程并发篡改文件系统的安全边界。
崩溃遗留锁需要后续明确恢复流程，目前宁可拒绝启动，也不误接管其他服务。

#### Hermes 装配与隔离实测

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

#### 尚未完成，不能作为发布启动器

##### Windows 进程树包装器（尚未原生验收）

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

##### 本机网页控制接口增量

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

##### 管理 HTTP → 真实 Hermes 集成增量

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

<a id="launch"></a>

## 实验启动与安装恢复

当前已接线，但完整浏览器联动和 Windows 进程树仍未验收。不要替换 P0 默认入口。
此入口不自动下载、升级、配置或启动 Hermes；需要已有完整运行实例和 Workbench 生产构建。

#### Windows 命令

开发快照安装器为包内 `scripts/install-p2-package.ps1`，必须先校验外层 ZIP 哈希再执行。
`-Target` 必须是已有、已停止的测试实例；默认先预检，`-VerifyOnly` 不安装。
实际写入还需 `-Experimental` 和手工输入 `INSTALL`。安装器只写白名单 P2 文件，
先在目标 logs/diagnostics 创建备份及恢复清单，不触碰 data 内容、原 launch.bat、源码和运行时。
受管后端锁存在时阻止安装；请同时关闭管理页和其他原生 Hermes 入口，这些不能仅靠该锁发现。
安装器本身与清单不是签名机制：外层 ZIP 的可信下载来源与哈希校验仍然必要。

在未来测试包已装入的测试实例根目录执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-p2-workbench.ps1 -Experimental
```

脚本使用本实例 portable Node，检查 ready/位置记录和构建资源。若盘符迁移尚未修复，先回 P0 修复；
P2 不自动覆盖运行时或用户数据。源码存在跟踪修改时拒绝，已知版本不等于发布验收通过。

#### 操作与退出

1. 打开本机管理页面时后端尚未启动。
2. 临时管理令牌通过 URL 片段交接，页面读取后移除；只保留在页面内存，不写持久存储。
3. 点击“读取服务状态”，idle 时才能“启动本实例并连接”。真实消息可能产生模型费用或工具操作。
4. 页面停止前需勾选确认；只停止本管理器持有的实例，不停止所有 Hermes，也不是回滚。
5. 终端输入 `EXIT` 关闭管理服务器及其实例；`OPEN` 再打开管理页。
6. 刷新/离页会丢失页面内令牌，需要 `OPEN` 重新进入。关闭浏览器不代表后端停止。

片段令牌是临时本机凭据，不要分享完整链接或含令牌的截图。控制台只打印无令牌的 Origin。
该入口不是对恶意本地进程的隔离边界。

#### 开发机显式路径入口

Linux/macOS 可用 Node 执行 `workbench/scripts/launch-managed.mjs`，必须同时显式提供
`--python`、`--source`、`--home`、`--git` 的绝对路径和 `--experimental`。
不搜索个人 Hermes 或自动导入密钥；但指定 home 内的配置仍由 Hermes 使用。
不要对个人配置实例随意联调，优先使用 bwrap 隔离探针。

#### 验证边界

参数门禁、片段解析、客户端和控制接口单元测试已通过；管理 HTTP 到真实 Hermes 的隔离探测已通过。
操作系统浏览器打开、完整页面按钮到真实服务以及 Windows 原生路径仍待验收。
### 中断安装恢复（开发入口）

从已核对外层 ZIP 哈希的独立解压包运行安装器，不使用可能只更新了一半的目标目录脚本。
使用相同 `-Target`，增加 `-Recover -VerifyOnly` 只做恢复预检。
预检通过并关闭目标全部服务后，改用 `-Recover -Experimental`，核对路径并输入 `RECOVER` 才执行。
恢复只处理活动安装标记指向的固定外壳白名单；会保留备份，不恢复或删除用户数据。
目标文件出现后续修改、备份校验失败或实例锁仍在时均停止，不强制覆盖。
真实断电可能留下实例锁，目前不自动按 PID 判断并接管；应保留现场，先核对进程所有权。
此入口只覆盖已生成完整恢复清单的安装，不能修复任意损坏的运行环境。
