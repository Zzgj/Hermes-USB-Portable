# 可直接发送给接手模型的任务文字

你将接手 Hermes-USB-Portable 的 P2 开发，完成后由 Codex 审查和修改。

当前工作区：`/home/zgj/桌面/CodeRepository/Hermes-USB-Portable`。
若你使用另一台机器，请以我提供的完整工作副本为准，不要仅克隆 Git HEAD。
请核对本地交接提交 `chore: checkpoint P2 development for model handoff`，不要使用旧的 P0 HEAD 代替它；原工作区所有后续改动必须保留。交接提交没有自动推送远程。

先阅读适用的 AGENTS.md，然后依次读取：

1. `docs/p2/MODEL-HANDOFF.md`（当前事实、代码地图、边界与批次方案）
2. `docs/PROJECT-PLAN.md` 的 P2 清单
3. `docs/p2/VALIDATION.md`
4. `docs/p2/CONFIG-INTERFACES.md`
5. `docs/p2/EXPERIMENTAL-LAUNCH.md`、`SERVICE-LIFECYCLE.md`

先检查实际代码并重跑 workbench 的 npm test、npm run validate、npm run build。
上次结果是 102 项测试、16 个组件检查及生产构建通过；这是参考，不替代你的验证。

本轮优先完成交接方案的 **A 批：真实能力卡片最小闭环**：
实例 Skill 草稿 → 参数与范围审阅 → 重核方法指纹/实例 → 明确确认 → Hermes 执行 →
关联真实任务结果。先支持单 Skill；Bundle 未核实就保持不可用，不实现新的工作流引擎。

关键要求：
- 不调用有未审计副作用的 command.dispatch 进行“只读预览”。
- 不信任导入卡片声明的指纹；执行前重核。切换实例、重复点击、断线和迟到响应必须安全处理。
- 不自动发送、重发、批准或发布；工具审批仍交给 Hermes 的实际审批机制。
- 模型轮次完成不等于业务验证；没有证据保持未验证。
- 不修改个人 Hermes 配置、密钥、真实设备或宿主服务；使用隔离环境/合成夹具。
- 不删除既有修改，不做无关重构，不擅自升级依赖、提交、推送或发布。
- 后端新文件同步打包白名单。保持 release_ready:false，除非真实完成发布门禁并经审查。

本轮不要为了“达到 70%”修改统计或减少范围。A 批完成并自测后停止扩展，
按 `docs/p2/RETURN-REPORT-TEMPLATE.md` 写实际交付报告，交回 Codex 审查。
若接口有重大不确定性，先提供证据和选项，不靠猜测实现危险兼容路径。
无需让我现在反复进行 U 盘测试；未具备环境的验证明确列为未执行。

最终交付：完整代码（包含新增文件）、更新后的任务/验证记录、回交报告和剩余问题。
不要只发“已完成”的总结，也不要附任何凭据或个人数据。
