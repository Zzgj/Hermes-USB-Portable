# P2 内核基线检查

2026-09-08 开发机 HEAD：`28044757aabd34010bd9f5f3e3f82b0906b46241`，
`git status --porcelain --untracked-files=no` 为空。该检查只证明已跟踪源码未修改，
不审计未跟踪文件、第三方依赖或用户配置。

bootstrap：`29112bef099274229cadff79cdff7bf7b99c4b77`。
两提交的 `web_server.py`、`tui_gateway/server.py` 有实际差异；即使
`desktop_contract` 都为 6，也不足以证明完整兼容。

U 盘历史记录：`f58fcc8118d9db092ad60d363d4a28520e08ac5a`，
当前本机 Git 对象库没有该提交，U 盘未连接，因此没有核实其当前内容。
不能声称它损坏或不兼容，也不能直接当作已通过。

## 机器可读清单与预检

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
