# P0 验收证据摘要

本页整理用户反馈与 CI 记录，不要求重复执行历史故障测试。
当前集中验收见 [ACCEPTANCE.md](ACCEPTANCE.md)。

## 已有证据

- 损坏 ripgrep 回执：单步重建，其余回执、数据/知识哨兵和 Git 状态保持正确。
  证据后缀：`p0-ripgrep-recovery-20260905-123146/result.json`。
- 损坏 rg.zip：拒绝坏缓存，重新下载并校验，恢复可执行文件和 ready 标志。
  证据后缀：`p0-rg-cache-recovery-20260905-124011/result.json`。
- 下载受控失败与续跑：失败不生成 ready；恢复原锁和缓存后续跑成功。
  测试脚本退出码误判已独立复核：
  `p0-interruption-retry-20260905-124604/result-addendum.json`。
- Soft Reset：删除沙箱 Runtime/源码，数据、知识、日志文件哈希不变；
  `HermesPortable-P0-SoftReset-Evidence-20260905-133623-b5fb7e19`。
  后续使用绝对 Root 重建退出码 0，保留检查及 Hermes 导入通过。
- 官方更新：`update-apply-20260905T090649717Z-91855f95.json`，
  官方及外壳退出码均为 0；提交从 `29112bef` 更新至 `f58fcc81`，
  双方回执一致，Runtime manifest 已更新，声明版本仍为 0.21.0。
  该次大小写冲突通过人工备份绕行，不能算自动处理的实机证明。
- NTFS U 盘 CLI/TUI/Web 收发、安全拔插后聊天、换电脑 F→E 后 Web 收发成功。
  exFAT 上 npm workspace 链接失败，不视为 TUI/Web 支持的文件系统。
- RC2 提交 `540d444` 的 CI run `34047793403`：Windows PowerShell
  5.1、7 和候选包构建均成功；覆盖新增修复、回退和中断边界夹具。

## 不应混淆的边界

- 核心探针通过不证明旧会话 cwd、Web STOP 或全部可选工具均可用。
- 新增修复及内核恢复仍需一次集中实机验收；不宣称 P0 已完成。
- 宿主 Cua 包和旧 Gateway 任务单独记录，不自动删除，不宣称零宿主落地。
- 原始证据保存在用户实例或外部备份，不随源码发布；不要分享密钥、完整
  会话、数据库备份或未经审核的原始日志。
