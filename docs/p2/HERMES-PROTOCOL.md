# Hermes 结构化协议：源码调查与接入门槛

## 调查范围（2026-09-08）

本轮只读检查开发机现有 Hermes 源码，HEAD 为
`28044757aabd34010bd9f5f3e3f82b0906b46241`。这不等同于用户 U 盘上的
`f58fcc8118d9db092ad60d363d4a28520e08ac5a`，也不等同于 bootstrap 锁定提交。
已完成下述隔离服务握手探测，但未发送真实会话请求，不能将本调查标记为 P2-03 全部完成。

## 已看到的接口形状

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

## 当前前端基础

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

## 下一道门槛

1. 在明确隔离的 HERMES_HOME 下启动与目标匹配的源码，不借用个人会话或自动读取模型密钥。
2. 验证实际认证引导、ready、健康检查及不支持方法的错误；记录源码提交及受测能力。
3. 核实 session.create、prompt.submit、message.delta、工具/审批事件的字段，再接入 UI。
4. 请求超时清理等待项；断线后不自动重发有副作用的请求。先恢复身份、epoch 与事件序号再恢复显示。
5. 验证取消确认、失败、拒绝授权、服务重启、单实例与安全停止；不得以关闭浏览器代替停止后端。

未经这些门槛，界面继续明确标记模拟，不显示真实已连接或已授权。

## 隔离握手证据

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

## 空会话生命周期增量

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

## 流式文本投影

源码 `server.py` 的 `_stream` 发出 `message.delta`，文本字段为 `payload.text`；
最终 `message.complete` 携带完整文本及 `complete/error/interrupted` 状态，不是 `success`。
`src/domain/chat-events.ts` 据此实现单轮文本投影：增量追加、最终文本替换、按 session_id 隔离、
忽略重复/倒序序号、终态不被迟到片段覆盖，并限制显示缓冲长度。
这里只处理纯文本，不执行 rendered/HTML 字段。测试为合成事件，不等同于模型流实测。
尚未处理 interim、压缩、会话恢复及缺失序号的重放，不能据此开启自动恢复。

## 缺失模型配置的真实失败事件

隔离探针新增 `prompt.submit`：环境无外网和真实模型凭据，发送固定测试句，不复制用户消息。
2026-09-08 实测 `prompt_failure_observed:true`、`terminal_error_event:true`、
`tool_not_started:true`，其余握手和会话生命周期检查仍通过，进程退出码 0。
这证明该受测提交在本场景会产生 `message.complete` / `status:error`，
并非只返回提交请求的响应。前端必须继续消费事件，不能因 submit 返回便停止等待。
未验证成功模型回复或真实工具审批；本测试不产生外部模型费用。

## 单次审批答复增量

只读核对 `tui_gateway/server.py::_approval_request_payload` 和
`tui_gateway/methods_prompt.py` 的 `approval.respond`：事件提供 request_id、command、choices；
答复使用 runtime session_id、request_id、choice 和 all:false，结果为 resolved。
前端只展示服务允许的 once/deny，未知或缺失关键字段不允许授权；多个请求依次展示。
命令及原因是服务提供的信息，不代表前端已独立验证安全性。答复超时或 resolved 非 true 时
进入结果未知状态，不自动再次批准。收到答复确认不代表命令已执行成功或可回滚。
当前覆盖单元测试与构建，真实工具审批、重连后的待审批恢复仍未验证。
