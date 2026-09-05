# P0 RC1 集中验收说明

这是 P0 候选版本，不是 P0 已全部通过或新版图形管理外壳。版本命名 `p0-rc1` 与 Hermes 内核自己的版本号分开。

## 本次集成

- 已确认的两路径大小写冲突：更新前逐字节校验备份、保存恢复清单，再移出工作树；更新未改变提交时恢复原内容。未知源版本、未解决冲突的目标、暂存修改、链接文件会停止自动处理。备份留在 `logs/diagnostics/case-collision-*`，不会自动删除。
- 相对 Root 规范化；启动时检查 `portable-location.txt`，移动目录或换盘符后进入已有 Setup 修复。修复检查 venv 的真实 base_prefix 和 Hermes 模块路径，旧副本仍存在时也不能借用它通过验证。
- `P0-Workbench.bat` 集中入口：原启动器、CLI、TUI、localhost Web、Desktop 能力门禁、诊断和修复。缺少可选资产时报告不可用；不自动安装 Desktop 或系统服务。
- `portable-diagnostics.ps1` 生成 JSON：核心探针、锁与状态一致性、提交、路径归属、可选入口资产，以及 Cua/自启动/链接发现。探针每项最多等待 20 秒。报告不包含配置、密钥、会话、代理 URL 或外部路径。
- 源码测试包包含 SHA-256 清单；安装器先检查全包，再备份旧文件，失败时恢复本轮已写文件。仅更新外壳白名单文件，不复制 Runtime、data、knowledge 或私人日志。

## 获取和部署

GitHub Actions 的 `P0 candidate package` 仅在 Windows PowerShell 5.1 和 PowerShell 7 测试全部通过后产出 `Hermes-Portable-P0-RC1` artifact。下载 artifact 后解压，里面包含候选 ZIP 和 `.sha256`；校验 ZIP 后再解压到单独目录，例如 `E:\Hermes-P0-RC1-Package`。SHA-256 是完整性校验，下载来源仍须是本仓库可信 Actions 运行。

关闭目标实例的 Launcher、Chat、Gateway 和 Web。首先安装到现有脱敏沙箱，不覆盖唯一生产副本。进入解压后的 `Hermes-Portable-P0-RC1` 目录，执行一行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-p0-package.ps1 -Target 'E:\HermesPortable-P0-10-Sandbox-20260904-231542'
```

核对目标后输入 `yes`。安装器打印备份目录。随后打开目标的 `P0-Workbench.bat`。第一次启动旧实例会补做位置验证，不代表重新下载所有组件。源代码 ZIP（GitHub 自动生成的 Source code ZIP）不含构建生成的 `package-manifest.json`，不能代替此 artifact 做覆盖部署。

## 一次集中测试的顺序

1. 在沙箱运行菜单 7 修复，再运行菜单 6 导出诊断；核心检查应通过。没有 DeepSeek 配置的沙箱仍可做这些检查。
2. 测 CLI、TUI、Web；Web 只绑定 `127.0.0.1`。Desktop 未安装时应明确拒绝启动，不能误报成功。不要求为了验收安装所有可选能力。
3. 保留数据哨兵，运行官方更新检查与更新，核对新回执。对仍含旧冲突的独立测试副本验证自动备份；已经升级的沙箱不会再触发该迁移。无需把生产副本降级来制造用例。
4. 关闭全部实例后，把测试副本复制到 U 盘的专用新目录（含空格/中文），保留 E 盘原副本。使用不会跟随目录联接的复制方式；遇到 Cua 等外部链接先记录，不将链接目标当作便携资产复制。
5. 从 U 盘运行菜单 7，再菜单 6。检查位置、base_prefix、Hermes 模块均属于 U 盘副本；运行一次聊天/终端。安全弹出并重新插入，盘符改变时重复启动检查。
6. 汇总各位置生成的 `logs/diagnostics/p0-report-*.json`、更新摘要及数据哨兵比对结果，一次反馈。

## 明确保留的限制

- Cua 的宿主目录、用户 PATH、计划任务目前仅审计，不自动卸载；安装在 C 盘的组件不算已经便携化。报告中 ReparsePointsPresent 需要人工审查，扫描跳过 `.git` 和 `node_modules` 的内部子目录，不代表完整安全审计。
- 自动恢复冲突文件仅适用于更新没有改变 HEAD 的失败。HEAD 已改变的失败保留全部备份和官方回执，不能声称整个 Runtime 已自动回滚。
- 首次安装仍锁定已验证的 bootstrap 提交；没有未经完整测试就把 bootstrap 改为浮动 main。升级迁移针对已确认的原始两个 Git blob，未知变体安全停止。
- 外壳自动联网更新 UI 尚未实现；此候选版提供整包校验部署。图形管理外壳后续开发，Hermes 自带 Web 是独立入口。
- Windows CI 不替代实际 exFAT、换电脑、代理网络、已配置 Chat/Gateway 的实机验收。收到集中验收结果后再决定是否结束 P0。
