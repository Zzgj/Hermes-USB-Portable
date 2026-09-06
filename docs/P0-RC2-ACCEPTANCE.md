# P0 RC2：一次集中验收

RC2 是集中测试候选，不代表 P0 已通过最终验收。不需要重装 Runtime、
重新复制 U 盘、格式化或重复此前的破坏性缓存/Reset 测试。

## 安装目标

当前新电脑 U 盘实例为 `E:\Hermes-P0-RC1-Test`。文件夹名称继续保留，
里面的 Workbench 标题会更新为 RC2。不要把旧 E 盘源实例作为安装目标。

下载本次 CI 的 `Hermes-Portable-P0-RC2` 制品，外层解压后校验内部
`Hermes-Portable-P0-RC2.zip` 和同名 `.sha256`。把包解压到独立目录，
例如 `C:\Hermes-P0-RC2-Package`，不要直接解压覆盖运行实例。

关闭实例全部聊天、Web、Gateway、Workbench 窗口，在包内执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-p0-package.ps1 -Target 'E:\Hermes-P0-RC1-Test'
```

核对目标后输入 `yes`，保存 `P0_PACKAGE_INSTALLED backup=...` 输出。
若盘符已不是 E，先确认实际路径，再替换命令中的目标。

## 一次功能验收

1. 从 U 盘运行 `P0-Workbench.bat`，确认标题 RC2。
2. 选 7，预期健康实例不重复安装；选 6 保存诊断报告。
3. 选 9：配置目录与会话目录分开确认。只接受同一便携目录的盘符映射，
   有候选才询问 `yes`；不要为了出现成功标记人为制造错误。
4. 选 2、3 分别聊天。新会话和一个旧会话各执行 `pwd`、
   `command -v git`、`git --version`，不运行 `uv sync` 或上游测试。
   终端不应再默认进入不存在的旧盘符目录。
5. 选 4，Web 服务在独立控制台启动。浏览器中测试新/旧会话各一次收发。
   结束聊天后回到控制窗口输入 `STOP`。这会强制停止本次启动的进程树，
   不是优雅保存正在生成的回复；确认返回 Workbench 且原 URL 不再提供服务。
6. 原启动器中查看日志、配置及只读更新检查，确认都能返回菜单。网络错误
   应保留日志、明确失败，不应变成更新成功。本轮无需为了验收升级到新的上游版本。
7. 关闭进程，安全拔插后重新打开，诊断和聊天仍正常；保留一份拔插后报告。

`InteractiveChatVerified=False` 表示报告自身没有执行聊天，不表示你刚才
的实测失败。`SourceDevelopmentVenvPresent=True` 只报告额外开发环境，
不自动删除。`SessionCwdRepairCandidates` 为候选目录数，不包含会话正文。
`LegacyTerminalCwdInEnv=True` 需结合实际终端结果审核；不要分享 `.env`。

## 恢复验收：只在单独沙箱

不在日常实例上做故障注入。自动化已覆盖外壳回退、目录交换的全部中断边界、
配置与 SQLite 数据保留、恢复点篡改/越界拒绝；最终真机恢复只需一个
无私人数据的独立沙箱。若未准备沙箱，先保留此项待验，不冒险执行。

恢复管理器位于 `scripts/manage-hermes-checkpoint.ps1`：

- `-Mode Create`：保存 Runtime 和源码恢复点，需足够额外空间。
- `-Mode Restore -CheckpointId <精确ID>`：确认后恢复这两棵目录，旧目录保留。
- `-Mode Undo`：撤销有活动标记的中断恢复，不依赖 Python 可用。

内核更新前自动创建恢复点；创建失败不会启动官方更新。恢复点位于
`updates/hermes-checkpoints`，交换记录与旧目录位于 `updates/hermes-restores`。
恢复只能用于原实例路径；不要跨盘符直接使用旧恢复点。

外壳回退是另一个操作。从解压包执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-p0-package.ps1 -Target 'E:\Hermes-P0-RC1-Test' -Backup '<安装时生成的完整备份路径>'
```

它校验当前文件仍与安装时一致，遇到用户后续修改会拒绝覆盖。它不恢复
Runtime 或内核，也不删除用户数据。新版本引入的外壳文件有可恢复副本。

## 最后反馈

只需一次提交：安装/诊断结果、新旧会话终端结果、CLI/TUI/Web 收发与停止
结果、拔插结果、沙箱恢复结果或尚未测试说明。不要发送 API Key、完整会话、
SQLite 备份或源码检查点。检查点可能包含 Git 配置等私密信息。

宿主 Cua、旧 Gateway 计划任务作为已知外部依赖独立记录，不代表核心环境
迁移失败，也不能宣称全部工具零宿主落地。Desktop 未安装时的明确提示是
可选入口预期，不要求额外安装。统一图形外壳和自动外壳更新不属于 RC2 已交付功能。
