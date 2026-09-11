# P2 Workbench 前端

独立于 P0 的 React/TypeScript/Vite 工程。原启动器、Runtime 与用户数据不变。
设计来自 Stitch 项目 `311402794707550434` 的六个页面；原始 HTML/截图留在
本机 `.stitch/designs/`（不发布、不作为应用执行代码），同步元数据与提取后的
`resources/style-guide.json` 可追溯。界面文字与数据集中在 `src/data/mockData.ts`。

## 当前范围

- 首页、聊天演示、任务状态/审批演示、资源与 Skills 列表、初始化向导。
- 知识、工具、终端及设置入口；设置区分内核更新与外壳更新，真实动作禁用。
- 默认页面为演示。`/chat/live` 是明确标记的真实连接实验：用户主动输入本机服务端口和临时服务令牌后建立会话，发送可能产生模型费用或工具操作。不要输入模型 API Key。
- 实验入口仍未完成发布验收：不自动启动后端，单次审批答复已接入但尚未实测真实工具，不作为普通用户安装方案。不会自动连接、发送、批准或重发；消息和输入令牌不写入浏览器持久存储。
- 不复制原图中的凭据提取/绕过示例、不展示虚构的本机健康、硬盘或 GPU 数值。
- 原图明暗主题混用，统一语义色及对比度；无需 Google Fonts/CDN，未安装字体用系统回退。

## 开发方式

在本目录运行 `npm install`，随后 `npm run dev`。默认只监听 `127.0.0.1:5173`。
`npm run build` 先做 TypeScript 检查，再生成 `dist/`；`npm run preview` 只用于本机预览。
`npm run validate` 检查组件 AST 与只读 Props。开发验证结果另行记录，不把代码存在视为测试通过。

工程参考 [Vite 文档](https://vite.dev/guide/) 和 [Tailwind 3 Vite 接入](https://v3.tailwindcss.com/docs/guides/vite)。
构建使用相对资源路径、HashRouter，已增加仅绑定 localhost 的实验管理服务与 Windows 启动入口，
见 [实验启动说明](../docs/p2/EXPERIMENTAL-LAUNCH.md)。不能双击 dist/index.html 替代服务启动。
便携启动仍待 Windows 验收，当前包是开发快照而非 RC。

执行能力复用 Hermes；本工程不另建 Agent/工作流引擎。任务模拟仅作 UI 夹具。
Agent 与 Skill 内容由 Hermes 在独立测试实例配置，本仓库负责必要 UI 与便携适配。
