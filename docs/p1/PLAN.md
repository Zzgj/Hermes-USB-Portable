# P1：远程 API、代理和便携知识

更新：2026-09-20。阶段整体未完成；只读接口盘点与 P2 共用 [工程手册](../p2/ENGINEERING.md)，不另建配置系统。当前授权与整体状态见 [总计划](../project_plan.md)。

## 目标

在不重写 Hermes provider/profile 系统的前提下，建立 Workbench 可使用的配置和知识边界。

## 任务清单

- [ ] **P1-01** 盘点 Hermes Providers、Models、Fallback 和 Profiles 的实际配置接口。
- [ ] **P1-02** 实现多 API 连接和多模型配置原型，支持连通性测试，不在日志中显示密钥。
- [ ] **P1-03** 实现直连、系统代理和自定义 HTTP(S)/SOCKS 代理模式与测试矩阵。
- [ ] **P1-04** 评估可选便携 Mihomo Core，不默认捆绑 Clash Verge。
- [ ] **P1-05** 定义凭据两种模式：便携密文/用户解锁，以及宿主安全库引用；明确备份和遗失风险。
- [ ] **P1-06** 建立便携 Obsidian Vault 模板，设置 `OBSIDIAN_VAULT_PATH`，验证读、搜索、创建和编辑。
- [ ] **P1-07** 定义 Memory（事实）、Obsidian（长期文档）、Skill（可重复流程）的写入与脱敏规则。
- [ ] **P1-08** 实现 Profiles、Vault、Skills 和 Sessions 的备份/恢复清单，不自动上传。
- [ ] **P1-09** 建立 API/代理/知识的脱敏诊断报告。

## P1 验收条件

- 至少两个远程 API 连接可切换并可独立测试。
- 直连和至少一种代理模式经过验证。
- 凭据不进入 Git、日志、任务记录或 Obsidian 文档。
- Hermes 能在指定 Vault 内执行受控的 Markdown 操作。
