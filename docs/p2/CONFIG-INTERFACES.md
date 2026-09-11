# 配置与能力接口适配清单

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

## 已发现的执行风险

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
