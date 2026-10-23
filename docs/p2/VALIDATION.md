# P2 验证记录

## 2026-10-22 DASHBOARD-ENTRY-10 页面就绪检查

- 基线 `66a6ebbb62f36e0cadca0b7001b93a736819e6c3` 加五文件 overlay，实际执行于本 Profile scratch 独立导出树；固定上游契约文件、全部源码哈希、命令/退出码/日志见 `evidence/p2-dashboard-entry-10/results.json`。旧 adapter 在新缺页用例下退出1；开发中 GET-only 资源用例也曾退出1，已修正 HEAD 假设，两个失败日志保留。中间62项结果不是最终源码证据。
- 最终两份语法检查退出0；九文件 Node 64通过、0失败/跳过，退出0；validate18组件、build退出0。新构建运行现有 native-entry-browser-check：7项通过、starts/stops/opens各1、managedStarts=0、cleaned=true、hermesModelExecuted=false，退出0。源码执行前后哈希一致，仅复用 manifest/lockfile 匹配的现有 node_modules，不安装依赖。
- HTTP 证据为真实回环服务+合成首页/资源；集成用例调用生产 adapter 和新检查器，但 RPC/进程/打开浏览器为替身。浏览器脚本使用真实工作台页面/HTTP和合成 native adapter，不覆盖原生 Dashboard 页面或新的HTTP检查器全链路。未运行全量npm test、Windows/Python原生批次、真实Hermes/模型、安装或真实实例更新。正式集成与发布门禁保持。
- 2026-10-23 独立只读纠错复审 `deleg_f832f60a`：五文件与 manifest、Git index 和实测副本一致；撤回 `deleg_3db180d1` 的测试第21行语法阻塞。直接读 bytes 确认所报截断字面量不存在、完整请求头字段表达式存在，该行116 bytes；没有修改源码或重新执行测试。所审五文件与直接调用范围内无可证实剩余阻塞；页面截止覆盖首页/资源正文，不是 RPC+页面合计5秒。复审结论不代替动态验证、实际 JavaScript 执行或 Windows 实机验收。

## 2026-10-21 EXPERIMENT-EXECUTOR-09 固定源码 overlay 验证

- 总监授权接管开发与本轮验证；lead 在基线 `846d34a226fbbd6fcd7e031a1b0924f7733ace5f` 的独立导出树覆盖六份受控源码/测试，身份及完整命令见仓库根 `evidence/p2-experiment-executor-09/results.json`。两份 Node 语法检查、六文件 Node 定向 39/39、Python worker 4 通过/3 Windows 跳过、Python native host 3 通过/2 Windows 跳过，命令均退出 0。validate 18 组件及新构建退出 0。
- `before.log` 是两项新增异步契约在旧执行器身份读取阶段失败，退出 1，不是原生进程树复现；`readiness-before.log` 是发布 ready.flag 碰撞后错误保留成功收据的实际失败断言，退出 1。后续通过日志单列，不覆盖历史红灯。原日志字节与脱敏发布字节的 SHA-256 分开记录，仅替换本机路径。
- 本机 Node v24.15.0 / npm 12.0.2；隔离构建只链接已有 node_modules，package.json 与 package-lock.json 与主仓库逐字节一致，未安装。此证据不证明 Windows 受控 runtime/uv/npm 组合可用。源码 overlay 执行后哈希未变化；未运行全量 npm test、浏览器、真实 Windows 命令或安装、Hermes、模型、真实实例。
- 新 Windows worker 三场景及原 host 两场景在 Linux 明确跳过；Windows supervisor/worker 的实际组合、真实 CLI 交互、材料来源与部署仍待。独立审查结论尚未收到，开发检查点不放行正式集成或 release_ready。

## 2026-10-13 HISTORY 提交推送前复验

- 用户追加授权“提交推送”。本轮接手 HEAD e83f0600f11fc0e8decf471c4604ae61d1f79485，分支 feat/portable-initializer，现场为已核对的 11 修复文件与四份文档，没有额外改动或暂存。`git ls-remote --heads origin refs/heads/feat/portable-initializer` 返回相同 SHA；最终推送成功与否以提交后精确远端回读为准。
- 11 个实现/测试文件仍与修复清单哈希一致。在主工作区 workbench 再次执行 `node --test tests/*.test.mjs`：退出 0、280/280、零失败/跳过；`npm run validate`：退出 0、16 组件；`npm run test:s1-browser`：退出 0，包含 tsc/Vite 新构建、methodVersion 3 的 19/19、cleaned=true。日志位于本 Profile deliveries/p2-history-integration-20261013-0850/prepush-{test,validate,browser}.log。
- 本次只交付源码、测试和项目文档，不纳入 dist/node_modules/Runtime/个人配置，不改变 release_ready。真实模型/审批、Windows/U盘与公司既有基线失败未通过本轮 Linux 结果替代；没有宣称公司四文件未提交补丁已逐字节审完或已同步。

## 2026-10-13 HISTORY 主工作区整合后重新验证

- 授权：用户明确同意“先本地整合并验证，暂不提交推送”。接手核对实际路径、feat/portable-initializer、HEAD c346ab4595ab4e3326f0b6f3c2f4bfd555c96835、origin/upstream 配置；现场仅四份已知文档修改，无暂存或未跟踪文件。本轮不联网更新远程引用。
- 保护：四份文档原字节、原 diff、SHA-256 清单保存于本 Profile deliveries/p2-history-integration-20261013-0850/original、original-docs.diff 和 original-manifest.json。验证旧 HEAD 为 e83f060 的祖先，文档与快进文件无交集，交付补丁哈希与 patch-manifest.json 相符。
- 实际整合：`git -c core.hooksPath=/dev/null merge --ff-only e83f0600f11fc0e8decf471c4604ae61d1f79485` 退出 0，快进而非新建合并提交；随后对 HISTORY-REPAIR-e83f060.diff 执行 `git apply --check` 和 `git apply` 均退出 0。没有 stash/reset/强制覆盖。11 个修复文件与交付清单逐一哈希一致；四份文档在整合后与备份一致，再作本轮记录更新。
- 本轮以下命令实际在 `/home/zgj/桌面/CodeRepository/Hermes-USB-Portable/workbench` 运行：`node --test tests/*.test.mjs` 退出 0、280/280；`npm test` 退出 0、280/280；两者均零失败/零取消/零跳过。`npm run validate` 退出 0、16 组件；`npm run test:s1-browser` 退出 0，包含 tsc/Vite 新构建，浏览器 methodVersion 3、19/19、cleaned=true。
- 证据：上述主工作区命令的独立日志及 results.json 在 deliveries/p2-history-integration-20261013-0850；不把前一轮隔离测试日志当本轮复跑结果。验证层级仍为 Linux 单测/生产 hook 合成调度、实际 Chrome/React/管理 HTTP 和合成上游/RPC；未执行真实模型/原生审批/Windows/U盘。
- 当前 HEAD 为 e83f0600f11fc0e8decf471c4604ae61d1f79485，修复及文档保持未提交；不声称该 SHA 已含修复。没有 fetch/push/公司侧同步，没有更新旧 ZIP、真实实例或 release_ready。公司 Windows startup recovery marker 的原失败仍待平台复验，未被本次 Linux 全绿关闭。

## 2026-10-13 HISTORY 负责人隔离审查与修复

- 用户在群聊授权负责人接管修复，暂不通知另两名 Agent。检查时主工作区仍为 `c346ab4595ab4e3326f0b6f3c2f4bfd555c96835`，保留四份文档修改；本地 Git 对象已有 `3f2c5fd` 与 `e83f0600f11fc0e8decf471c4604ae61d1f79485`，本轮没有 fetch/pull/merge/commit/push。原四份文档另存于本 Profile scratch/history-repair-evidence/original-docs。
- 交付身份：公司只提供了 `workbench/history-patch-e83f060.diff` 的远端机器路径和文字摘要，未传来可读补丁字节，本机该路径不存在。因此本次审查已提交的 c346ab4..e83f060，并在 scratch/history-repair-e83f060 的 detached worktree 独立修复；不宣称应用或逐字节审完公司四文件未提交补丁。公司报告的 270 项结果不与本次测试数混用。
- 复现：真实 loopback 管理 HTTP + 合成上游在响应头后停滞，17.5 秒客户端截止先触发；同时 catalog 返回 409，客户端断开/服务关闭未能及时取消。确认原 15 秒定时器只包围 fetch 响应头阶段。服务端投影 `{sessionId,messages:[{role,text}],omitted}` 与客户端 raw decoder 契约不一致；此外 historyAccess 被改为管理令牌/port=0，使能力和学习的 RPC 身份校验失败。原提交新构建成功，但浏览器在能力提交阶段 UI_WAIT_TIMEOUT，仅前 4 项完成，尚未到达历史正文测试，不把这个失败当原用户闪退根因证明。
- 修复：历史读使用独立最多 8 个在途请求，不占管理变更 busy/pending；15 秒截止覆盖连接取得、响应头和正文；通过响应 close 与完成状态取消断开的上游；停止/关闭先取消并等待在途读，实例/代次变化拒绝旧结果。非成功及超限响应取消 body；限制 1 MiB、50 条、合法解析 ID、20k 单条/100k 总文本，仅投影允许字段。客户端只走同源管理代理；RPC 身份继续供能力/学习守卫使用；断线清除正文；补错误文案。
- 保留既有压缩会话可解析到新 ID 的契约，不采用回交摘要中的请求 ID 必须与解析 ID 完全相等规则；两端检查解析 ID 的格式。未新增恢复执行、存储、依赖、模型调用或外部监听。
- 红灯方法：把新增的 history-boundaries/history-hook 两测试文件放入精确 e83f060 导出树，执行 `node --test tests/history-boundaries.test.mjs tests/history-hook.test.mjs`，退出 1，16 项中 2 通过/14 失败；这些是失败断言，不等于 14 个独立产品缺陷，hook 部分失败也受旧投影格式影响。修复后同组 16/16；最终受控补丁在重新导出的基线上 `git apply --check`、实际 apply、11 文件逐字节比对通过，该应用树同组再次 16/16，退出 0。
- 最终开发侧命令均在隔离 worktree 的 workbench 下执行：`node --test tests/*.test.mjs` 退出 0、280/280；`npm test` 退出 0、280/280；`npm run validate` 退出 0、16 组件；`npm run test:s1-browser` 退出 0，包含 tsc/Vite 新构建与 methodVersion 3 的 19/19 浏览器检查，cleaned=true；`git diff --check` 退出 0。日志和 results.json 在 scratch/history-repair-evidence。
- 浏览器使用实际 Chrome/React 页面、真实管理 HTTP、合成上游/RPC；保持原生 fetch/XHR。修正旧夹具错误路由/隐藏页面操作、React 输入事件、错误响应绕过 hold、无条件点击不存在关闭按钮、固定等待冒充在途屏障等问题。覆盖持续显示/重开、四种服务错误/重试、15 秒超时/重试、空会话、主聊天、关闭/断线/重连后的隔离。生产 hook 使用最小合成调度器额外验证忽略 abort 的迟到 success/catch/finally 不覆盖新请求；不是把该调度器当真实 React 验证。
- 本机 Linux 的 lifecycle-boundaries 基线和修复树均通过；公司 Windows 的 startup recovery marker 失败仍未在其平台复验，不推断根因或关闭问题。公司 `npm test` 自报退出 0 但含 fail 1 不算通过。本轮未做 Windows/U盘/真实模型/原生审批，也未更新已有 ZIP 或真实实例，release_ready:false 不变。
- 源码补丁：本 Profile deliveries/p2-history-repair-20261013/HISTORY-REPAIR-e83f060.diff，随附逐文件哈希清单与命令日志；scratch/history-repair-evidence 保留原验证现场。SHA-256 `9480fdd293219e1ab2588fb66e3b8723152351dc8a6a273ce6da8cc9ea60dc91`，含 9 个修改文件与 2 个新增测试，不含 node_modules 链接、dist、个人配置或公司数据。当前是隔离修复已验证，不是已整合到开发分支或发布。

## 2026-10-12 群聊接手证据与待核验失败

- 负责人本机 HEAD 为 c346ab4595ab4e3326f0b6f3c2f4bfd555c96835，feat/portable-initializer；首次接手 fetch 与 pull --ff-only 均完成，远程跟踪差异 0/0，工作区干净。后续派单前再次核对本地 HEAD、分支、远程配置及工作区；未再次联网同步或宣称新的远端状态。
- 本机 Node v26.7.0、npm 11.19.0、npm ls --depth=0 通过，已有 Chrome；这是环境检查，不是本轮应用构建或功能回归。
- 公司实现者群聊报告：同一基线，node --test tests/*.test.mjs 为 250 项、240 通过、1 失败、9 跳过。失败名 startup rechecks recovery marker；未收到精确断言与命令退出码，负责人未独立复现。当前仅记为基线失败报告，平台根因未定，不引用历史 installer/skill-catalog 失败为其证明，不声明 S1 全量通过。
- 本轮仅更新计划/派单/证据文档，未修 HISTORY、未运行模型/真实实例、未修改内核或配置、未提交/推送。实现及独立页面验收须由后续实际执行补证。

## 2026-10-12 P2-S1-SYNC-01 推送前复验与用户反馈边界

- 推送前核对本地 b986738，分支 feat/portable-initializer，origin 远端 b11bd5a 为本地祖先；现有中文批次与三份文档修改均保留。本轮将当前文件及交接更新纳入提交，不新增功能修复，不重新生成安装包。
- 本轮 workbench 下 `node --test tests/*.test.mjs` 退出 0，250/250；`npm run validate` 退出 0，16 组件；`npm run test:s1-browser` 退出 0，含 TypeScript/Vite 新构建和 methodVersion 2 的 10/10 浏览器断言，cleaned=true、RPC 合成、未执行模型。日志 scratch/p2-sync-20261012-{test,validate,browser-build}.log。未安装或升级依赖。
- 用户实机口述反馈与本机自动测试分开：已确认模型回复/多轮/文件读写/取消/正常停止重启和旧会话索引；历史正文一闪消失且无错误、主聊天仍可发送，属于失败反馈，本机未复现、根因未定。审批没有出现，记未触发；断线重连记未测。
- 自动测试通过不能关闭 HISTORY-01；下一批需实际页面和生产调用链失败回归。模型配置 GUI、旧会话恢复执行与 S2/S3 仍未完成，release_ready:false 不变。只发布脱敏项目状态，不含端点、用户名、Key 或会话正文。

## 2026-10-11 P2-S1-LAUNCHER-ZH-01 中文启动界面开发验证

- 最终交付：Hermes-Portable-P2-S1-First-Install-ONLINE-ZH.zip，370264 字节，89 个 payload，SHA-256 70fc2ce4c88f206ca1d1f02b77fc228fb9e77dce10e418a24507105956f9c92f；CRC、安全路径/无链接/大小写唯一、精确清单、逐文件大小与哈希、旁车一致性通过。保留原 ONLINE 基包身份，明确 source_dirty=true，覆盖文件在清单 source_overlays 中列明，不冒充干净 b986738。
- 审查后将 P2-Workbench.bat 纳入 P2 增量白名单；launch.bat 仍归 P0 所有，只随完整首装包交付。本次完整归档包含两份 BAT；对应保护性断言通过。最终源码重新运行 250/250、validate 16、build，均退出 0。
- 最终解压包运行 p2-first-install-smoke.mjs 通过；隔离夹具 scripts 链接解析到解压目录，运行 launcher-zh、lifecycle-boundaries、owned-process-tree 共 17/17、退出 0，日志 scratch/p2-first-install-zh-regression.log。同一解压 launch-managed.mjs 运行 p2-launcher-zh-live-smoke.mjs 退出 0，真实管理 HTTP/认证/中文退出/令牌不输出均通过，浏览器打开调用为合成失败，不等于 Windows 默认浏览器实测。
- 归档冻结后的最终证据在包外 ARCHIVE-RESULTS.json、DELIVERY-RESULTS.json 与本节；包内进度文档保留打包前快照，不回写冻结 ZIP。核心生命周期与首装安装逻辑未改；未提交/推送，Windows 实机和公司模型仍未验。
- 基线 b986738，保留既有三份首装文档修改。本轮改动仅启动展示、P2 入口/操作别名、打包白名单及对应测试/说明；无内核/依赖/协议/存储或发布资格变化。
- 先增四项测试，旧实现 0/4：缺中文展示与两个新增文件；这是新增需求红灯，不是四项既有生产缺陷。实现后新增真实 line 回调提取执行验证，默认新增共 5 项。
- `node --test tests/*.test.mjs`（workbench）退出 0，250/250，日志 scratch/p2-launcher-zh-suite.log。`npm run validate` 退出 0、16 组件；`npm run build` 退出 0、TypeScript/Vite 构建完成。
- `node tests/s1-browser-check.mjs`（workbench）退出 0，methodVersion 2、10/10、cleaned=true；真实 Chrome/React/HTTP、合成 RPC，不调用模型。日志 scratch/p2-launcher-zh-browser.log。
- `node <scratch>/p2-launcher-zh-live-smoke.mjs workbench/scripts/launch-managed.mjs` 退出 0：临时无内核 Git 仓库提供合成源码身份，生产 launch 函数实际启动管理 HTTP；未授权请求拒绝，合成浏览器打开失败后的中文提示和重新打开别名有效，输入“退出”后真实 HTTP 不再可达，输出不含管理 URL 凭据。仅浏览器进程调用被替换为失败夹具，不调用模型/工具，不启动 Hermes。本探针不计入 250 个默认测试。
- BAT 使用 UTF-8 无 BOM、全 CRLF，首个中文前执行 chcp 65001；含中文的 PowerShell 回归文件加 UTF-8 BOM 兼容 Windows PowerShell。Linux 无 pwsh，未执行该 PowerShell 测试或 Windows BAT；不宣称终端实机显示通过。主菜单调用 P2 前局部恢复原 APPDATA/LOCALAPPDATA，避免原生便携环境影响默认浏览器的配置目录。
- 此处记录源码开发验证；新归档独立验证与最终交付结果记录在后续条目/包旁车，不沿用旧包哈希。本批未提交、未推送，release_ready:false。

## 2026-10-09 P2-S1-FIRST-INSTALL-RECHECK 实际安装包复查

- 直接复查 First-Install-ONLINE.zip：SHA-256 仍为 953030908ecbfdf8920e025c6d3ba0c99fb1db02590dfec0567cc3705e47f76d，88 个 payload，CRC、精确清单、大小/哈希全部通过。空盘入口 launch.bat、P2-Workbench.bat、基础脚本及组件清单存在；静态本地辅助脚本名称扫描未确认缺失文件，扫描中的 main.py/__init__.py 属初始化下载的内核，不是遗漏的便携脚本。
- 再次运行最终解压包的 p2-first-install-smoke.mjs：manifest、入口静态参数、资产/认证/关闭通过；最终解压 scripts 对应生命周期测试 12/12、退出 0。未将该结果描述为 Windows BAT 实测。
- 核对默认 bootstrap 29112bef 的 agent/learn_prompt.py SHA-256 与包内 prepare-learn.py 白名单一致，实际执行包内 Python 准备器，返回 kind=learn 和非空 prompt，退出 0；使用合成输入，不调用模型或写 Skill。
- 将最终解压 scripts 原字节复制至只读探针挂载目录，仅额外加入测试探针。在固定 29112bef、bwrap 独立网络和清空环境中实际复跑管理验证 11 项 true、退出 0。首次因未复制 probe-websocket-origin.py 测试辅助文件而 MANAGED_PROBE_FAILED，日志 p2-first-install-recheck-managed.log 保留；补齐测试辅助文件、不修改包内生产字节后重跑通过，日志 p2-first-install-recheck-managed-rerun.log。该测试辅助文件不是安装运行必需文件。
- 结论：本轮未发现新的已确认归档/启动接线/限定生命周期阻塞缺陷；可作为空盘联网首次部署开发测试包，不声称已通过 Windows 首装。公司外网下载、脚本策略、Windows 运行时/依赖安装与真实模型审批仍未验。包仍需要联网，不是离线完整预装环境；本轮未修改或替换 ZIP，也未提交/推送。

## 2026-10-09 P2-S1-FIRST-INSTALL-01 空盘联网部署包验证

- 区别于此前增量 ZIP，本包从现有 P0 builder 相同源码白名单合并当前 P2 payload，包含 launch.bat、P0 脚本/manifests 和预构建工作台；包内新增 P2-Workbench.bat 仅相对当前根调用已有 start-p2-workbench.ps1，不增加执行策略绕过。START_HERE.md 明确空盘流程、下载要求和未验限制。未捆绑内核/Runtime，不宣称离线安装器。
- 打包源码 b986738fac8e5cc594d04891f0bbfca429ba1762，生成文件另列 first-install-manifest.json；当前 production 无变更。`npm run build` 退出 0。scratch/build-first-install-20261009.py 生成并验证 ZIP：363472 字节、88 个 payload，SHA-256 953030908ecbfdf8920e025c6d3ba0c99fb1db02590dfec0567cc3705e47f76d。验证 CRC、精确清单、大小写唯一、无穿越/链接、逐文件大小/哈希、源码匹配 Git（BAT 规范 CRLF）、禁入路径及实际最终解压，退出 0。
- 最终解压内容执行 scratch/p2-first-install-smoke.mjs，校验全部 manifest、P0/P2 必需文件、入口静态参数、真实静态资源/未授权拒绝和关闭，退出 0。将两份生命周期测试置于独立 scratch，scripts 指向最终解压代码，运行 12/12、退出 0，日志 p2-first-install-regression.log；不是 Windows BAT 实际执行证据。
- P0 默认 bootstrap 为 29112bef099274229cadff79cdff7bf7b99c4b77（不是先前开发探针 28044757）。从本机 Git 对象导出固定源码至独立 scratch，复用受控 bwrap 命令，将源码替换为该导出路径；只读源/运行时、清空环境、隐藏个人 home、独立网络、无模型。初次因只读源缺少 venv 挂载点失败，保留 p2-first-install-bootstrap-29112be.log；只在导出目录补空挂载点后复跑 probe-managed.mjs，11 项 true、退出 0，日志 p2-first-install-bootstrap-29112be-rerun.log。
- 本轮未执行 Windows 下载/依赖安装或真实 U 盘初始化，不能将 Linux 服务探针等同目标首装验收。外网不可达时本 ONLINE 包不能完成空盘初始化；不能静默降级为模拟模式。Windows/公司模型/审批保持未验，release_ready:false。ZIP 与旁车位于 deliveries/p2-s1-first-install-online-20261009，归档冻结后不回写本记录。

## 2026-10-09 P2-S1-USB-PACK-02 最终修复包验证

- 源码提交：4090b4d0846f537ceb832d9f4464af69936ae18e，分支 feat/portable-initializer；打包前工作区干净，无依赖/构建产物入库。17 个受控源码/测试/文档文件已本地提交，未推送；本节是后续仅文档交付证据，不改变被测实现。
- 在该提交 workbench 下执行 `node --test tests/*.test.mjs` 245/245、`npm run validate` 16 组件、`npm run test:s1-browser` 包含 tsc/Vite 新构建与方法 v2 10/10，均退出 0。日志 scratch/p2-usb-4090b4d-{node,validate,browser}.log；浏览器 RPC 合成，未调用模型。
- 执行 `node workbench/scripts/build-p2-package.mjs <repo> <profile>/deliveries/p2-s1-usb-20261009-4090b4d`，退出 0。最终 Hermes-Portable-P2-development.zip：236501 字节，35 个 payload，SHA-256 98d8505f12228a069ebe54d38befd29271e22e1f149060c9f5a94b9a6d32ffde。状态 development-snapshot，release_ready:false，没有放宽发布门禁。
- scratch/p2-usb-verify-4090b4d.py 实际校验最终 ZIP 的 CRC、大小写唯一/无穿越/无符号链接、精确文件集合为 manifest 清单加 manifest、自带 .sha256、所有文件大小与 SHA-256、禁入数据/配置/依赖目录；非 dist 文件逐字节对照 Git 提交，dist 对照新构建。全部通过、退出 0，再解压至 scratch/p2-usb-final-4090b4d。
- 对最终解压内容执行 `node <scratch>/p2-company-package-smoke.mjs <extracted>/Hermes-Portable-P2`，退出 0。真实包内 installer 在临时合成 P0 目标完成只读预检、安装前备份、数据哨兵保留、全部安装字节一致、恢复标记/自有锁释放；从安装目标实际导入 control-server，静态资源/认证与关闭检查通过。未操作用户真实便携实例。
- 另将现有两份生命周期回归置于 scratch/p2-usb-extracted-regressions-4090b4d，scripts 指向最终 ZIP 解压脚本，复用已安装测试依赖（不入包）；`node --test tests/lifecycle-boundaries.test.mjs tests/owned-process-tree.test.mjs` 12/12、退出 0，确认包内修复不是旧源码。日志 p2-usb-4090b4d-extracted-regressions.log。
- 同交付目录提供使用说明.md 与 DELIVERY-RESULTS.json。新包可供限定 P2-S1 集中测试，替代停用旧包；不代表 Windows/真实模型/审批验收完成。依赖已有独立 P0 根，不含内核或运行时，不是完整空盘安装器。包内文档为 4090b4d 打包前快照；外层哈希及本次完成证据不回写 ZIP，避免自引用。

## 2026-10-09 P2-S1-RECHECK-02 修复后复查与交付状态

- 对象仍为 3400686 加已接管修复工作区；接手先执行已交源码补丁的 `git apply --reverse --check` 通过，文件清单与上一轮一致。重新审阅关闭/重试、持锁启动、POSIX 退出屏障及 cardId 差异；本轮不修改生产代码、不提交或推送。
- 在本 Profile scratch/p2-final-recheck-20261009.mjs 增加三项独立探针：连续三次 stop 拒绝均保留各自原始错误且 HTTP 已关闭、第四次可成功；启动请求进行中关闭管理器，等待取得实例句柄后只停止一次；异步 beforeStart 持锁期间拒绝另一锁持有者，守卫拒绝后释放自有锁。每项在有父进程超时的独立子进程内运行，不启动 Hermes，不记录令牌。`node --test <scratch>/p2-final-recheck-20261009.mjs` 3/3，退出 0；属于额外探针，不加到默认套件数量中。
- 本轮重新执行 `node --test tests/*.test.mjs` 245/245，零失败/取消/跳过；`npm run validate` 16 组件；`npm run test:s1-browser` 的 TypeScript/Vite 新构建和浏览器 v2 10/10、cleaned=true。各退出 0，日志 scratch/p2-final-recheck-20261009-{extra,node,validate,browser}.log。管理 HTTP 真实、RPC 合成；不覆盖公司模型、原生审批或 Windows。
- 结论：在本轮审阅和实际执行范围内，三项已确认缺陷的修复仍成立，未发现新的已复现阻塞缺陷；不声称代码绝对无缺陷或完整 S1 实机验收通过。POSIX 主动脱组、不确定停止保留锁，以及 S2/S3 未完成功能仍按 ACCEPTANCE 限定。
- 交付状态单独核验：本 Profile deliveries 仅有原开发 ZIP，SHA-256 仍为 81a7115b24312ccc3c7573ead37440d56cf41aef374815438f1efefd15e5e49b。包内 control-server/hermes-instance/owned-process 与当前修复源码均不同，原包继续停用。当前源码可作为 P2-S1 集中测试候选，尚不是已完成替代包交付；须重新构建归档、解压验证清单/安装/启动并附新哈希后交公司测试。release_ready:false。

## 2026-10-09 P2-S1-REPAIR-01 中断接管独立复验

- 用户确认另一会话因额度停止，授权接管三项缺陷修复。HEAD 仍 3400686db091d493855c2048949c6868f63e690a；接手工作区共 17 个修改/新增文件原样保存至本 Profile scratch/p2-fix-takeover-20261009，manifest.json 记录逐文件 SHA-256。保留原实现，不重复覆盖，不提交或推送。
- 接手定向：`node --test workbench/tests/lifecycle-boundaries.test.mjs workbench/tests/owned-process-tree.test.mjs`，11/11、退出 0。独立用 `git archive HEAD workbench` 导出旧源码至 scratch/p2-fix-red-baseline-20261009，复制接手的两份新测试并复用既有依赖，同一 11 项测试 10 失败/1 通过、退出 1，red.log 保存确切失败；没有把旧源码覆盖当前工作区。
- 红灯分别命中 launcher 失败提前关闭重试入口、HTTP 关闭失败监听仍在、持锁前注入恢复标记仍到达 spawn，以及正常/抗 TERM/父提前退出/超时/实例隔离/锁保持等后代生存断言；spawn 失败原路径为绿色。证明测试确实能暴露三项原缺陷，不以当前全绿倒推旧版本安全。
- 接管后新增 health-failure 树场景及重复停止断言，保留独立硬截止与 owned PID 清理；修正文案，限定普通进程组后代，不承诺主动脱组进程或裸 PGID 的不可复用性。既有 cardId 防御性补丁和测试保留，未将其升级为跨卡生产误发缺陷。
- 当前 workbench 实际命令与结果：`node --test tests/lifecycle-boundaries.test.mjs tests/owned-process-tree.test.mjs` 12/12；`node --test tests/*.test.mjs`、`npm test` 各 245/245（零失败、取消、跳过）；`npm run validate` 16 组件；`npm run test:s1-browser` 包含 TypeScript/Vite 新构建与方法 v2 的 10/10，cleaned=true。每条退出 0；日志 scratch/p2-fix-20261009-{focused,node,npm,validate,browser}.log。
- 验证层级：真实 loopback 管理 HTTP 配合合成实例；生产 launcher 的 AST 提取 handler；真实自有 Node 三级进程及 managed lock；Chrome/React/真实管理 HTTP 配合合成 RPC。没有调用模型、连接公司网络、安装依赖或操作个人实例。本轮未重跑真实 Hermes 探针，下方前一会话记录不可冒充本次执行。
- 三项源码修复已在开发工作区通过本轮独立回归。旧 ZIP 不包含修复且保持暂停；本轮未重打包、提交或推送。POSIX 主动 setsid 脱组不在保障范围；组存在或无法确认消失时不报告停止成功、不释放锁。Windows/真实模型/审批仍待环境验证，release_ready:false。

## 2026-10-09 P2-S1-REPAIR-01 红灯、隔离修复与落地验证

- 基线 3400686db091d493855c2048949c6868f63e690a 加原八文件未提交快照；scratch/p2-repair-20261009-snapshot.json 保存接手哈希，隔离目录 p2-repair-20261009 复用已安装依赖。不覆盖既有浏览器/文档修改，不提交或推送。
- 红灯：新增 lifecycle-boundaries.test.mjs 最初 2/2 失败，分别为关闭后监听仍存活及恢复标记竞态到达 spawn；追加实际 launcher shutdown AST 提取回归后 1 失败/2 通过，定位 input 提前关闭阻断重试。cardId 新增定向测试退出 1，属于防御性守卫遗漏而非生产跨卡误发复现。POSIX 树回归修复前 5 失败/1 通过，见 scratch/p2-owned-tree-red.log；直接父进程退出不能证明后代退出。
- 修复九文件：scripts/control-server.mjs、hermes-instance.mjs、managed-instance.mjs、launch-managed.mjs、owned-process.mjs；src/domain/capability-run.ts；tests/s1-capability-chain.test.mjs；新增 tests/lifecycle-boundaries.test.mjs、owned-process-tree.test.mjs（均相对 workbench）。控制服务保留 stop 原始错误并释放监听，可显式重试；启动持锁重核 marker；launcher 失败保留重试入口；POSIX 普通后代进程组消失后才完成退出屏障；守卫比较 cardId 后才进入真实调用点提交。
- 新增树测试覆盖三级 Node 普通后代、忽略 TERM、父先退出、启动超时、另一实例不受影响、spawn 失败及真实 managed-instance 锁保持。测试只使用自有合成进程，有独立看门狗与清理。Windows 特定路径未作实机验证；主动 setsid 脱组不保证清理，组权限错误/不可终止/僵尸未回收时不报告停止成功。裸 PGID 并非原生不可复用句柄，首次观察到 ESRCH 后永久停用该组 ID。
- 隔离定向主审 46/46、树/进程/锁定向 20/20；隔离全量与主工作区落地均 `node --test tests/*.test.mjs`、`npm test` 各 244/244、零失败/跳过（每条退出 0）。`npm run validate` 16 组件，`npm run test:s1-browser` 包含 tsc/Vite 构建及方法 v2 10/10，均退出 0、cleaned=true。日志 scratch/p2-repair-{isolated,main}-{node,npm,validate,browser}.log；新旧通过数不相加。
- 主工作区另复跑原受控 bwrap 命令（scratch/s1-real-managed-probe-command.json）：固定 Hermes 28044757aabd34010bd9f5f3e3f82b0906b46241 源码、清空环境、隐藏个人 home、独立网络；绑定本次修复后的 scripts。退出 0，认证/错误令牌/单实例/停止锁释放及管理 HTTP/Origin 共 11 项 true，日志 p2-repair-main-real-managed.log。未连接模型、未读取个人配置。
- scratch/p2-repair-20261009.patch 含全部九文件，已在主工作区 apply --check 后应用并复验。当前为已落地的未提交修复，不是仅隔离通过；旧 ZIP 不含本修复，继续暂停，最终替代包另按归档验证结果确认。release_ready:false 不变。

## 2026-10-09 P2-S1-RECHECK-01 复审结论：需返工

- 对象：feat/portable-initializer，HEAD 3400686db091d493855c2048949c6868f63e690a 加既有五个 tracked 修改和三个新增测试文件；本轮不修改生产实现、不提交或推送。远程仅核对本地配置/跟踪引用，未 fetch 或宣称远端最新。
- 主审重新执行 `node <scratch>/p2-control-close-review.mjs`，退出 0，复现 close 拒绝后 HTTP 仍返回 403、重复 close 不重试停止。这里的退出 0 是缺陷断言成立，不是安全验收通过。
- 两项生命周期问题经独立审查后，由主审读取探针并重新执行 `node <scratch>/p2-lifecycle-readonly-probe.mjs`（退出 0）确认：① hermes-instance.mjs:15 的恢复标记检查在 managed-instance.mjs:5 获取锁之前；在实际锁 mkdir 前注入标记后 forbiddenSpawnCalls=1，证明待恢复实例仍到达 spawn。探针拦截 spawn 并抛合成错误，未启动 Hermes；markerRetained/lockReleased 均 true。② owned-process.mjs:27–29 只停止直接子进程，managed-instance.mjs:9 在其退出后释放锁；真实合成后代在 managerState=stopped、lockReleased=true 后仍写 heartbeat。后代固定短时自退出，探针确认结束并清理夹具。第二项只证明 POSIX/Linux 路径，不推断 Windows Job Object 失败。
- 主审核对归档 SHA-256 仍为 81a7115b24312ccc3c7573ead37440d56cf41aef374815438f1efefd15e5e49b；包内 control-server.mjs、hermes-instance.mjs、managed-instance.mjs、owned-process.mjs 均与被复现源码字节一致。旧包继续暂停公司测试，未重打包或解除暂停。
- 前端补充审查：canCommitCapability 未比较 cardId（capability-run.ts:14–21），但 prepareCapabilityRun:31–32 已校验响应 ID，页面 choose:29 清空请求引用、execute:20 拒绝迟到响应；定性为防御性守卫/测试缺口，不列为已复现的跨卡误发。独立审查的真实 handler 提取测试不是完整 React DOM 生命周期验收。主审未确认新的前端生产误发缺陷，不代表所有跨实例场景已验。
- 本轮在 workbench 执行 `node --test tests/*.test.mjs`：232/232、零失败/跳过，退出 0；`npm run validate`：16 组件，退出 0；`npm run test:s1-browser`：tsc/Vite 构建及方法 v2 的 10/10，退出 0、cleaned=true。日志在本 Profile scratch/p2-review-20261009-{node,validate,browser}.log。浏览器实际 Chrome/React/管理 HTTP，RPC 合成，无模型调用；绿灯不能覆盖以上新增异常路径。
- 结论：三项生命周期缺陷需返工。先补异常关闭、持锁恢复标记复核、POSIX 后代存活的定向回归，再在隔离现场修复并做完整回归与新包验证。真实模型/审批、Windows/U 盘仍待环境验证；release_ready:false 保持不变。

## 2026-10-08 P2-S1-RECHECK-01 主审初步复现（其余独立审查待回交）

- 对象：3400686 加现有测试/文档工作区；交付 ZIP 哈希再次核对为 81a7115b24312ccc3c7573ead37440d56cf41aef374815438f1efefd15e5e49b，包内 control-server.mjs 与本机源码字节一致。
- 确认缺陷：control-server.mjs:95–102 的 closePromise 在 instance.stop 抛错后永久拒绝；server.close 未执行，closing 已设 true。launch-managed.mjs 的 shutdown 又会关闭输入并设置 stopping，不能据“请求关闭”认定管理服务已退出。
- 自有子进程中启动真实 startControlServer，注入会拒绝 stop 的合成实例，实际 POST /api/start 200；close 拒绝后仍能收到 HTTP 403；再次 close 仍拒绝且 stopCalls=1。JSON 为 closeRejected:true、listenerStillAcceptsRequests:true、httpAfterClose:403、repeatedCloseRetriesStop:false。探针自行退出以清理其监听，不涉及真实 Hermes 或其他进程。
- 脚本/输出：本 Profile scratch/p2-control-close-review.mjs、p2-control-close-review.log，命令 node <scratch>/p2-control-close-review.mjs 退出 0 表示缺陷被复现，不是安全检查通过。
- 同轮 node --test tests/*.test.mjs 232/232、npm run validate 16 组件、npm run test:s1-browser 的构建及 10 场景均退出 0；日志 p2-rereview-{node,validate,browser}.log。这些通过不能覆盖上述失败路径，旧包暂停公司测试。前端/生命周期独立审查尚未回交，未声明全面复查完成。

## 2026-10-08 P2-COMPANY-TEST-01 候选包与安装后检查

- 最终归档打包后证据：Hermes-Portable-P2-development.zip，228837 字节，SHA-256 `81a7115b24312ccc3c7573ead37440d56cf41aef374815438f1efefd15e5e49b`，35 个 payload 文件。实际从最终 ZIP 解压，重新执行同一 package-smoke，退出 0；清单/哈希、预检只读、安装字节一致、旧外壳备份、合成数据保留、锁/标记清理及 HTTP 静态资源与认证检查全通过。机器可读结果在同目录 COMPANY-TEST-RESULTS.json。包内文档冻结于打包前，本条外层哈希不回写 ZIP，防止自引用；未改变已测代码。
- 基线 3400686 加受控工作区修改，不是干净 result SHA。用户将真实模型测试安排在公司独立环境；公司模型名称、可达性和费用均未经本机验证，不写入任何内网地址、配置或凭据。release_ready:false，包状态仍为 development-snapshot。
- 开发工作区 workbench 重新执行：`node --test tests/*.test.mjs`、`npm test` 各 232/232、零跳过；`npm run validate` 16 组件；`npm run test:s1-browser` 包含 tsc/Vite 构建及 methodVersion:2 的十项浏览器断言，全部退出 0。日志为本 Profile scratch/p2-company-{node,npm,validate,browser}.log。
- 使用既有 build-p2-package.mjs 的严格白名单生成候选包，不改打包/安装生产脚本或兼容门禁。35 个清单 payload 文件，加 p2-package.json；清单路径无重复，ZIP 实际文件集合与清单完全一致，CRC 及逐文件 SHA-256 通过，排除 .git/node_modules/.env/auth.json/data/sessions/.cache。不把编译产物或日志反向纳入 Git。
- 在自有临时合成 portable target 上导入包内 install-p2-package.mjs：只读 verify 未改变旧 index 或数据哨兵；apply 后所有清单文件哈希一致；旧外壳原文保留于备份；合成 data/sentinel.txt 字节未变；安装标记和实例锁释放。没有对真实安装目录或 U 盘操作。
- 再从已安装目标导入包内 control-server.mjs，用其提供已安装 dist：HTML 及引用 assets 均 HTTP 200；未认证 status 为 403，持管理 token 的 status 为 idle，未启动后端；关闭后 HTTP 不可连接。仅本轮临时目录/服务被清理。这是 Linux 包内运行证据，不替代 Windows PowerShell、Job Object、真实模型或业务审批验收。
- 验证脚本位于 scratch/p2-company-package-smoke.mjs，候选日志 p2-company-candidate-package.log、p2-company-candidate-smoke.log。最终包将再次校验精确清单、哈希及安装后行为；外层哈希单独交付，避免将 ZIP 自身哈希写入 ZIP 内产生自引用。
- 公司操作说明在 ACCEPTANCE 的开发测试批次节。包为依赖既有 P0 环境的外壳增量，不是全套便携安装器或 P2 全功能交付；原任务和真实模型/Windows/U盘验收勾选不据此关闭。

## 2026-10-08 P2-S1-REAL-NOMODEL-01 固定 Hermes 无模型隔离复验

- 工作台 HEAD 3400686db091d493855c2048949c6868f63e690a，加已有六文件未提交浏览器/文档批次；这些实现文件本轮未改。真实 Hermes 固定为兼容性清单 development 基线 28044757aabd34010bd9f5f3e3f82b0906b46241；本机安装源码 HEAD 3251a180f01ad21ae059862997307bf75f3e3f0a 不作为被测源码。
- 准备：从既有 Git 对象 git archive 导出固定基线至本 Profile scratch/s1-real-hermes-280447-source，检查无 .env/auth.json/state.db 这些凭据或个人库文件名，不复制工作区配置。只读复用既有 venv 与其 Python runtime generation；不安装、不拉取远端、不改 Hermes 源码或 Profile。
- 隔离采用既有 probe-hermes-isolated.sh/probe-managed-isolated.sh 的 bwrap --unshare-all 模式，针对导出源码/共享解释器显式调整只读挂载。宿主根只读，/home、/root、/tmp、/run 被新 tmpfs 隐藏，环境清空；源码在沙箱 /tmp/p2-source，venv 在其子目录，只有必需 runtime generation 子树额外可见。沙箱内 /tmp 为内存文件系统，不是宿主系统临时目录；所有宿主产物在本 Profile scratch。
- 前置实测：网络 namespace 与宿主不同；个人 Profile 配置不可见；固定源码 .env 不存在；无继承 API_KEY；hermes_cli 实际导入路径位于 /tmp/p2-source/hermes_cli。探针 runtime token 仅存在子进程内存/环境，不输出到日志。
- 环境适配失败如实保留：第一次把新挂载点设为只读根下 /p2-source，bwrap 报 Can't mkdir /p2-source: Read-only file system；改为 namespace tmpfs 下的 /tmp/p2-source。随后仅挂载 canonical Python 目录，venv 的解释器别名无法解析，报 execvp ... No such file or directory；只读挂载包含别名的同一 runtime generation 后，隔离 import 通过。没有改写个人 venv 或解除网络/目录隔离。
- 协议命令：在上述 bwrap 中执行 `/tmp/p2-source/venv/bin/python /tmp/probe.py`，probe.py 只读绑定仓库 scripts/probe-hermes-protocol.py，prepare-learn.py 同样只读绑定。退出 0、stderr 零字节。真实服务启动、未认证拒绝、gateway.ready、unknown method -32601、契约 6、隔离会话 cwd、创建/关闭、stale interrupt 4001、重复关闭 false 全部符合断言。
- 无 provider 的 prompt.submit 返回失败并出现 status:error 的 message.complete；tool_not_started 为 true。不代表真实模型完成回复或工具执行。skills/list、learn 注册解析、Profile 摘要不含会话、历史 HTTP 认证及本机 Origin、固定学习提示构造器指纹检查通过；未执行学习文件产出。
- 管理命令：在同等隔离环境只读绑定 Node 和仓库 scripts，执行 `/tmp/p2-node /tmp/p2-scripts/probe-managed.mjs /tmp/p2-source`。退出 0、stderr 零字节，11 项布尔断言全为 true：authenticatedHealth、rejectsWrongToken、singleInstance、stopped、lockReleased、controlUnauthorizedRejected、controlStartReady、localOriginAccepted、foreignOriginRejected、controlStopIdle、controlLockReleased。
- 两个探针均使用真实 Hermes WebSocket/HTTP，不是浏览器合成 RPC；但没有把真实浏览器与此隔离服务连接，不能把两组独立通过拼成完整端到端。此处也不声明管理/RPC 凭据双向互换拒绝已全部验证。
- 本机精确 argv 保存在 scratch/s1-real-hermes-probe-command.json 与 s1-real-managed-probe-command.json；脱敏输出分别为 s1-real-hermes-probe.log、s1-real-managed-probe.log。argv 不含 token，但含本机路径，跨机必须重新定位，不直接复制。探针结束后扫描其沙箱 cwd/命令确认无自有进程残留，tmpfs 数据随 namespace 释放；固定导出源码作为复验材料保留。
- 本轮没有修改应用实现，未重复计入之前 232 单测/10 浏览器场景；这批新增的是固定源码真实服务无模型证据。未提交、未推送、未发布；真实模型/审批/活动取消、Windows/U盘仍待环境及授权，release_ready:false 不变。

## 2026-10-08 P2-S1-BROWSER-RUNNER-01 方法版本 2：取消/重导入与重连

- 基线仍 3400686 的现有未提交批次；仅扩展 tests/s1-browser-check.mjs 的浏览器步骤及本阶段文档，不改生产代码、驱动接口、依赖或发布门禁。保留版本 1 的八项历史证据，当前报告 methodVersion:2，共十项唯一名称断言。
- 新场景 cancel-reimport-held-prepare-no-stale-review：真实管理 HTTP prepare 在服务端等待，浏览器文件输入 disabled；点击当前卡片经真实 choose 路径取消，重新导入新显示名称的同一方法，再释放旧服务请求；确认无可提交旧审阅、合成 prompt.submit 总数保持 1。本案例覆盖主动取消与重导入，不声称覆盖所有跨卡或取消无效的服务实现。
- 新场景 explicit-reconnect-no-replay：在原有二次核验延迟期间关闭合成 socket、释放响应的场景之后，经实际页面导航点击“连接本实例”；确认 session.create 次数仅增加一次，返回能力页无旧审阅，prompt.submit 仍为 1。此处只是显式重连相同合成 RPC 身份，不等于真实 Hermes 重连或换实例/令牌验收。
- 保持原生 fetch/XHR；不通过直接调用 React 私有 handler 完成场景。旧响应释放后待服务端 held 解除并观察界面；无新增提交来自实际合成 WebSocket 记录，不由缺字段或静态计数推断。
- cwd：开发仓库 workbench。`npm run test:s1-browser`（含 tsc/Vite build，58 模块）退出 0，10/10；`node tests/s1-browser-check.mjs` 再跑退出 0，10/10；逐项核对十个名称唯一、全部 passed、cleaned:true、hermesModelExecuted:false。`node --test tests/*.test.mjs` 和 `npm test` 各 232/232、零跳过、退出 0；`npm run validate` 16 组件、退出 0。
- 原始日志：本 Profile scratch/s1-browser-v2-{browser-build,browser-repeat,node,npm,validate}.log。命令仍为方法版本 1 所列的仓库入口，环境和隐私边界不变；增加的是浏览器场景，故 Node 单测数量不增加。不把重复运行相加为二十项。
- 当前实现/限定 Linux 浏览器回归通过；缺 provider 的真实服务探针本轮仅读取未执行，真实模型/审批、Windows/U盘仍待验。未提交、未推送、未发布，release_ready:false 不变。

## 2026-10-08 P2-S1-BROWSER-RUNNER-01 仓库内复跑入口

- base SHA：3400686db091d493855c2048949c6868f63e690a；本批没有结果提交。接管原有 package.json、tests/s1-browser-check.mjs、s1-browser-driver.mjs、s1-browser-driver.test.mjs；快照与 manifest 位于本 Profile scratch/s1-browser-takeover-original。审查未发现需要修改生产逻辑的已复现缺陷，不虚构红灯修复记录。
- package.json 仅新增脚本；不新增依赖、锁文件或生产接口。已有入口采用无导入副作用的 runS1BrowserCheck，CDP pipe、临时合成 home/Skill、只替换 WebSocket 的夹具；实际管理 HTTP/catalog/prepare 和原生 fetch/XHR。重复导入使用唯一显示名称，普通操作等按钮 enabled，显式双击不增加等待以保留防重入断言。
- 接手初跑：`node --test tests/s1-browser-driver.test.mjs` 为 13/13、退出 0；`npm run test:s1-browser` 构建及 8 项浏览器检查通过、退出 0。随后补三项边界测试（超大帧拒绝、预取消不调用等待谓词、预取消入口先于发现/启动浏览器），并补 peer error 后下一请求实际成功断言；没有改变原驱动或入口实现。
- 最终验证 cwd 为开发仓库 workbench：驱动定向 16/16；`node --test tests/*.test.mjs` 与 `npm test` 各 232/232、零失败/零跳过；`npm run validate` 16 组件；`npm run test:s1-browser` 包含 tsc/Vite 58 模块构建和 8 项浏览器检查；再执行 `node tests/s1-browser-check.mjs` 8/8。上述命令分别退出 0，git diff --check 通过。
- 浏览器结果包含 methodVersion:1、status、failure、8 项固定名称断言、限定同源路径与 HTTP 状态、cleaned、rpc:synthetic、hermesModelExecuted:false。不记录查询串、运行时凭据、页面正文、用户 home 或原始 CDP 错误；Chrome 使用环境变量白名单及自有 HOME/cache/temp。清理仅针对本入口创建的子进程及目录，失败不报告成功。
- 证据日志为本 Profile scratch/s1-browser-takeover-{driver-initial,browser-initial,driver,node,npm,validate,browser-build,browser-repeat}.log。末行 JSON 已核对 8 项名称唯一、全部通过、cleaned:true；不将八项重复执行相加为更多场景。

### 复跑方法与边界（方法版本 1）

- 在已获批准的隔离测试环境、已有依赖及已安装 Chrome/Chromium 条件下，从 workbench 执行 `npm run test:s1-browser`。这会写 dist、创建临时合成实例和浏览器目录、启动本机回环管理 HTTP；不会启动 Hermes 或模型。
- 默认只探测 Linux 常见浏览器路径；可用 CHROME_BIN 指定已安装浏览器的绝对可执行路径，不自动下载/安装。缺浏览器返回 BROWSER_UNAVAILABLE、退出 1，而不是跳过成功。Windows 尚未实际验证，设置路径不能替代平台验收。
- 临时目录由 TMPDIR/TMP/TEMP 对应的系统临时根决定。本 Profile 已配置 scratch；换机须显式配置该机器批准的临时根，不复制旧机绝对路径、凭据或权限。Linux 根过长可能受浏览器 singleton socket 长度限制，环境不满足应报告失败，不改用未批准目录。
- 默认 `npm test` 只跑驱动/入口边界测试，不自动启动 Chrome；浏览器回归为上述显式命令。直接运行 Node 入口需事先构建，日常优先 npm 命令避免使用旧 dist。
- 适用范围仍为 Linux 实际 React → 真实管理 HTTP → 合成 RPC；真实 Hermes/Skill 执行、模型审批、Windows/U 盘未验，release_ready:false 不变。入口已在仓库工作区，不代表已提交、推送或发布。

## 2026-10-08 S1/R2/R4 统一整合复验

- 开发原基线 b11bd5a；先保存既有文档修改为 32b27e1，再于本 Profile scratch/p2-s1-integration 独立 worktree 合并 feac533f42c3ba5431db3079ee283b34e3c18398。未纳入 49e7e7d；原 R2/R4 工作区不变。
- 应用两个受控补丁前分别 git apply --check 通过：R2 的 SHA-256 为 `ac80fa003d4afd751ecc17d1054e83dcb983abd7fc9618158e00075a9124e9d4`，R4 为 `788053a1b38590b3823549c6178fe9c645d9a609f3f4bd93172581be80669f60`。补丁范围与上次审查一致，无依赖、产物或私人数据。
- 唯一合并冲突为本文件的历史验证节，保留双方记录并明确旧声明不作为当前验收。重复 REVIEW-2026-10-04.md 不在最终树维护，原文保留于交付 Git 历史。生产三文件与固定交付一致，R2/R4 只改测试和夹具。
- 环境：Linux / Node v26.7.0，已有依赖，临时数据位于本 Profile scratch，loopback 监听；没有安装依赖、读取个人实例、调用真实模型或修改发布资格。
- 工作目录 scratch/p2-s1-integration/workbench；逐项独立捕获退出码：`node --test tests/*.test.mjs` 为 0，216/216、零跳过；`npm test` 为 0，216/216、零跳过；`npm run validate` 为 0，16 组件；`npm run build` 为 0，tsc --noEmit 与 Vite 58 模块通过；git diff --check 与暂存差异检查为 0。
- 对本轮新构建运行 `node <scratch>/p2-s1-integration-browser-check.mjs`，退出码 0。该脚本由上轮验证方法仅改目标工作区和证据路径；8 项唯一命名检查全部通过，真实页面/管理 HTTP/catalog/prepare，RPC 合成且 fetch/XHR 保持原生。断言范围同上轮 R4，报告 p2-s1-integration-browser-results.json；报告仅记录同源 path/status 和布尔结果。
- 原始日志为 scratch/p2-s1-integration-{node,npm,validate,build,browser}.log；浏览器脚本仍属于 scratch 验证材料，尚未成为仓库常规回归入口。自有 harness、浏览器和临时 Profile 由 finally 清理，检查 HTTP 不可连接且临时 home 不存在。
- 结论：统一整合树的 Linux 代码/自动回归/限定真实管理 HTTP 验证通过；仅本地整合，不推送或发布。真实 Hermes WebSocket/Skill 执行、真实模型审批、Windows/U 盘仍待环境验证；不据 Linux 结果代替 Windows 独立验收，release_ready:false 不变。

### 开发工作区落地后复验

- 整合提交 `f59ff57203f942a858dc34fd26afe190b44d196a`，父提交为 32b27e1 与 feac533，保留双方历史。原开发工作区确认无未知修改后，以 git merge --ff-only 落到 feat/portable-initializer；未推送，远端开发分支回读仍为 b11bd5a，交付分支仍为 49e7e7d。
- 工作目录为开发仓库 workbench；重新执行直接 Node、npm test，各 216/216、零跳过、退出码 0；validate 16 组件与 build 58 模块均退出码 0。日志为本 Profile scratch/p2-s1-main-{node,npm,validate,build}.log。生产文件与隔离整合提交完全一致。
- 主工作区浏览器首跑完成前 5 项后 PAGE_EVALUATION_FAILED、退出码 1，未认定通过。原脚本重导入后仅等待相同 Skill 文本，可能命中上次仍显示的内容；点击前也未等待按钮可用，不能由此错误单独认定生产回归。
- 仅修正 scratch 浏览器驱动：每次导入使用唯一显示名称等待本次渲染，普通步骤点击等待 enabled，不改变显式连续双击的断言路径，不改生产代码或掩盖错误响应。`node <scratch>/p2-s1-main-browser-check.mjs` 连续 3 次分别退出 0、8/8 通过，均清理自有服务/浏览器/临时目录。
- 首次失败日志与 JSON 保留为 p2-s1-main-initial-failed-browser.*；成功日志为 p2-s1-main-browser-rerun-1.log 至 -3.log，末次 JSON 为 p2-s1-main-browser-results.json。后续可复跑入口整理须带入上述等待修正，而非照搬旧脚本。

## 2026-10-07 P2-S1-R4-HTTP-F1 负责人本机修复与真实 HTTP 浏览器验证

- 基线 `feac533f42c3ba5431db3079ee283b34e3c18398`，隔离 worktree `p2-r4-lead`；未纳入 49e7e7d 或 R2 补丁。公司 R4 补丁不在本机，负责人按原四文件边界自行实现，不宣称已审核公司未收到的代码。
- 改动仅 tests/s1-control-server.mjs、s1-browser-launch.mjs、新增 s1-http-harness.test.mjs 与 s1-rpc-only-fixture.js。无生产代码、依赖/锁文件、包白名单变化。
- 两个入口改为无导入副作用的 startS1Harness 进程内接口，原直接运行后打印含令牌 URL 的行为移除。真实 startControlServer、readSkillCatalog、prepareCapability 使用自有临时合成 home/skills；实例与 RPC 不启动 Hermes。调用者必须 finally close，凭据不写 stdout/stderr 或凭据文件。
- 先失败：构建后运行 `node --test --test-name-pattern='never writes credentials' tests/s1-http-harness.test.mjs`，2 项失败、退出码 1；仅报告输出长度 185，不打印实际凭据。修复后在子进程实际捕获两个入口及其启动/关闭生命周期的 stdout/stderr，均为零字节。
- 定向命令 `node --test tests/s1-http-harness.test.mjs`：11/11，退出码 0。覆盖认证/错误 origin/RPC 令牌拒绝、静态资源、身份隔离、真实目录与准备、Skill 变化的内部 CAPABILITY_CHANGED 和 HTTP 400、受控延迟、双实例独立关闭、临时目录删除、启动失败清理、原生 fetch/XHR 身份不变。
- 原始回归日志保存在本 Profile scratch 的 p2-r4-node.log、p2-r4-npm.log、p2-r4-validate.log、p2-r4-build.log。工作目录为 p2-r4-lead/workbench，Linux / Node v26.7.0：`node --test tests/*.test.mjs` 与 `npm test` 各 216/216、零跳过，`npm run validate` 16 组件、`npm run build` 58 模块，均退出码 0。未将公司 Windows 两项失败据此关闭。
- 浏览器方法：已有 Chrome headless，通过自有 remote-debugging-pipe/CDP 驱动真实 React DOM；临时浏览器 Profile 位于 scratch，未安装依赖，不接触个人浏览器数据。管理 HTTP 为真实 loopback 服务；只替换 WebSocket，不替换 fetch/XHR。凭据仅进程内传给浏览器，不输出；脱敏 Network 记录仅保留同源 pathname/status。
- `node <scratch>/p2-r4-browser-check.mjs` 退出码 0；p2-r4-browser-results.json 的 8 项断言：原生 fetch/XHR 与 bootstrap fragment 清除；真实 connection 重连；浏览器目录导出；首次准备且未确认时零 RPC 提交；连续双击只增加一次 prompt.submit 且真实第二次 prepare 被调用；更改 Skill 后真实 HTTP 400 且无新增提交；二次核验期间关闭合成 socket 后无重放；观察到静态资源/status/start/connection/catalog/prepare 的真实 HTTP 状态。
- 无提交使用实际合成 WebSocket 的 prompt.submit 计数，不再以 submitted 字段缺失替代；不执行 Skill 的限定依据是调用链只到文件读取与提示构造、实例启动回调无执行器，不把 SKILL.md 未变当成真实 Hermes 执行副作用验证。RPC/模型仍未实际执行。
- 浏览器初次尝试使用过宽 checkbox 选择器，点中了仍挂载的隐藏服务确认框，等待发送状态超时；收窄到能力确认标签后复跑通过。该失败属于测试驱动定位，不改生产代码、不冒充产品缺陷。
- 清理：await harness.close 后确认 home 不存在且 HTTP 不可连接；仅关闭自有 Chrome，删除自有临时 Profile。没有全局停止 Node/Python 或其他实例；没有本批后台测试。浏览器检查脚本仍为 scratch 证据，尚非仓库常规回归入口。
- 四文件受控补丁 p2-s1-r4-lead.patch（包含两项新增文件），SHA-256 `788053a1b38590b3823549c6178fe9c645d9a609f3f4bd93172581be80669f60`。在 feac533 + 保留 R2 修改的 p2-r2-review 上 `git apply --check` 为 0，但未应用。补丁不含 node_modules、dist、临时 Profile、令牌或日志。令牌相关断言使用布尔比较，失败时也不输出实际凭据。
- 结论：R4 本批 Linux 修复与限定页面→真实管理 HTTP 联合验证通过；整合提交、真实 Hermes WebSocket/审批/模型、Windows/U盘尚未完成。不改变 release_ready，不启动 S2 新实现。

## 2026-10-04 P2-S1-R3-BROWSER 实际 React 页面补证

- 对象：隔离 worktree 的 `feac533` + R2 两文件测试补丁，使用此前本机新构建；生产代码未变化。Vite preview 仅监听 loopback，独立浏览器页面，没有真实 Hermes/模型、个人配置或真实凭据。
- 方法：Browser Use 驱动实际构建页面的 DOM 事件；加载仓库 browser-rpc-fixture.js，外加页内合成 status/connection、可控 prepare 延迟/403/非法响应。React 的 App、CapabilitiesPage、useLiveChat 正常运行；没有直接调用 React 私有 handler。合成 WebSocket 记录 prompt.submit；HTTP/RPC 传输被替换，不能称为真实后端端到端。
- 逐项观察与断言（共 9 项，按 JSON case 去重核对）：
  1. 未勾确认：发送按钮 disabled，prompt.submit 为 0。
  2. 勾确认后同一 JavaScript 轮次连续点击两次：仅增加 1 次 prompt.submit，审阅清除并显示已交给当前会话。
  3. 暂存 prepare 响应，切到另一卡片后释放：旧审阅不出现，提交总数保持 1。
  4. 暂存第二次核验响应，派发 socket close 后释放：旧审阅清除，提交总数保持 1。
  5. 通过管理连接按钮重连：session.create 增至 2，prompt.submit 仍为 1，无自动重放。
  6. 第二次核验返回 403：出现可见错误、审阅清除，提交不增加。
  7. prepare 返回结构非法 JSON：出现可见错误、无可提交审阅，提交不增加。
  8. 新浏览器现场中暂存二次核验，导航聊天并主动断开，管理连接切至合成新端口/新令牌后释放旧响应：界面端口为 12346，session.create 为 2，prompt.submit 为 0。覆盖完整 UI 导航与 hook 接线，不据局部守卫猜测漏洞。
  9. prepare 等待期间文件输入 disabled；切卡取消后允许重导入，再释放旧响应：不出现旧审阅，prompt.submit 为 0。
- 自动化限制：使用 DOM click/input/change，不是物理鼠标全流程或无障碍验收；延迟夹具刻意允许取消后的响应被释放以验证调用方拒绝。一次异步工具等待超时后读取状态核对完成；另一次发现浏览器已为 about:blank、夹具消失，重建独立现场完成剩余场景，不将该工具状态变化归因于产品。
- 证据：本轮 scratch 的 p2-r3-results.json 逐项保存断言结果，p2-r3-browser-controls.js 为后半段合成控制脚本；这些不是已接入仓库的自动回归套件。正式可复跑自动化仍待整理。
- 清理：通过已核对的自有 PID/进程组停止 preview；浏览器导航至 about:blank 清除页内合成状态。没有停止其他 Node/Hermes 实例。
- 结论：上述合成传输下 React 交互通过；原 G1/G2 未在这些场景复现为生产缺陷。真实管理 HTTP 与真实 Hermes WebSocket 的页面联合验证、真实模型/审批、Windows/U 盘仍待验，S1/P2 不宣称全部完成，release_ready 不变。

## 2026-10-04 P2-S1-R2-WIN 负责人隔离复验

- 固定交付基线 `feac533f42c3ba5431db3079ee283b34e3c18398`；不包含后来越出只读任务范围的审计提交 `49e7e7d`。主开发分支未合入本批生产代码或测试补丁。
- 在独立 detached worktree、Linux / Node v26.7.0、已有依赖下执行；临时文件位于本 Profile scratch，未安装依赖、未启动真实 Hermes/模型、未读取个人配置。
- 补丁前：`node --test tests/installer.test.mjs tests/skill-catalog.test.mjs tests/s1-capability-chain.test.mjs` 退出码 0，38/38；本机未复现公司 Windows 的两项失败，不能据此否定其平台现场或独立确认其根因。
- 接收员工两文件测试修复：安装 fixture 对 target 做 realpath；目录用 NFC/NFD 碰撞及单独的大小写探测。负责人仅整理注释，不改变回交测试逻辑：去掉“所有平台/default macOS 必然支持该夹具”和 mkdir 会覆盖目录的表述，明确 EEXIST 分支未覆盖纯大小写拒绝。
- 补丁后同一条定向命令退出码 0，38/38；`npm test` 退出码 0，205/205，无跳过；`npm run validate` 退出码 0，16 组件；`npm run build` 退出码 0，58 模块；`git diff --check` 退出码 0。以上工作目录均为隔离 worktree 的 workbench。
- 受控补丁 `p2-s1-r2-win-reviewed.patch`：仅 installer.test.mjs 与 skill-catalog.test.mjs，2 文件 +24/-4；SHA-256 `ac80fa003d4afd751ecc17d1054e83dcb983abd7fc9618158e00075a9124e9d4`。已对主开发工作区执行 `git apply --check` 通过，但未应用。node_modules 复用链接和 dist 不在补丁内。
- 结论：测试修复 Linux 独立复验通过；Windows 205/205 为员工回交证据，负责人未复跑 Windows。S1 React 浏览器交互、真实 Hermes/审批和 U 盘仍未验证；不授予 S1 完整通过或发布资格。
- 下一步环境检查仅确认本机存在 `/usr/bin/google-chrome`；未据此声称浏览器自动化或端到端测试已可用/已通过。
## 历史交付证据说明

以下 2026-09-28/23 为固定交付 feac533 的历史记录，保留失败、返工和当时的覆盖声明以便追溯；当前结论以上方负责人独立验证为准。旧记录中仅凭 fixture 计数或条件复制宣称 UI 通过、将 Windows 根因直接归为大小写的表述，已被后续返工收紧，不作为现行验收依据。

交付附带的 REVIEW-2026-10-04.md 不另建副本，原文可从 feac533 的 Git 历史读取。其代码审查 APPROVE 不代表全链路或发布批准；预存失败以 R2 独立复验边界为准。

## 2026-09-28 P2-S1-R1 行为变异证据收尾（基于 451c8f5）

返工原因：上一版 mutation 测试仅做 AST 字符串断言（包含 `!!submitRun`、不含 `||`），未执行变异后的表达式，未证明"拒绝时提交次数为 0"的安全断言在变异副本上失败。审查要求将 AST 提取、表达式执行和安全行为断言参数化，让正常源码与变异副本复用同一管线。

### 修改内容（仅测试文件和文档）

**测试修正（仅 `tests/s1-capability-chain.test.mjs`）：**
- 提取 `extractCommitCheck(sourceStr,label)` 函数，参数化 AST 提取，正常源码和变异副本复用同一管线。
- 提取 `evalCommitCheckExpr(conditionText,thenText,...)` 函数，参数化表达式执行，正常源码和变异副本复用同一执行器。
- 新增行为变异测试 `S1-6c-mutation: mutated expression executes submitRun on mismatch (safety assertion fails)`：执行变异后的表达式，在 prompt 不匹配场景下，变异副本 submitRun 调用 1 次（正常源码 0 次），证明"拒绝时提交次数为 0"的安全断言在变异副本上失败。
- 原 AST 字符串断言测试保留为 `S1-6c-mutation: AST extraction detects broken form`。
- 测试数量从 28 增至 29，全部通过。

### 行为变异证据（内存副本，不写入磁盘）

| 源码状态 | submitRun 调用次数（prompt 不匹配） | 安全断言结果 |
|---|---|---|
| 正常源码（`||` 短路） | 0 | 通过（submitRun 未被调用） |
| 内存变异副本（`!!submitRun` 参数） | 1 | **失败**（submitRun 在拒绝前被调用） |

变异测试在内存字符串 `pageSource` 上执行 `.replace()`，通过 `extractCommitCheck` 重新提取，通过 `evalCommitCheckExpr` 执行，不触碰磁盘文件。生产源码未修改（`git diff --name-only -- workbench/src/` 输出为空）。

### 验证（工作目录 workbench/，Windows 10 / Node v24.14.0）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `node --test tests/s1-capability-chain.test.mjs` | 0 | 29 项全部通过 |
| `npm test` | 1 | 205 项，203 通过，2 项失败 |
| `npm run validate` | 0 | 16 组件通过 |
| `npm run build` | 0 | tsc --noEmit + vite build，58 模块 |

**2 项失败（历史已知，非本批引入；根因待核实，不单独证明为 Windows 大小写）：**
- `installer.test.mjs`：mid-install rename failure（`Missing expected rejection`，期望 `INSTALL_FAILED_ROLLED_BACK`）
- `skill-catalog.test.mjs`：catalog rejects links and case collisions（`Missing expected rejection`，期望 `COLLISION`）
- 基线对照：在 `7a655b8` 和 `451c8f5` 运行全量测试均出现同样 2 项失败、相同错误信息，确认非本批新增回归。根因标记为待核实，不单独归因于 Windows 大小写。

### 未验证范围

- AST 调用点测试在 Node 中执行，**不等于浏览器验收**。未在 React 组件渲染中验证（Chromium 缺失）。
- 真实 Hermes/Skill 链路、Windows/U 盘验收未执行。
- S1-9/10 仅域函数 epoch 守卫，未执行实际 end() 调用。



## 2026-09-28 P2-S1-R1 S1-6c 测试 AST 提取修正（基于 284518b）

返工原因：前次修正（284518b）的 S1-6c 测试在手写表达式中复制调用点代码，未读取实际页面源码。审查证实：在隔离环境临时破坏生产调用顺序后，该测试文件仍 26/26 通过；独立源码探针则正确失败。

### 修改内容

**测试修正：**
- `tests/s1-capability-chain.test.mjs`：S1-6c 改为使用 TypeScript AST 从 `CapabilitiesPage.tsx` 实际源码提取 commit-check 表达式（`commitIf.expression.getText(pageTree)`），不再手写复制。
- 新增 S1-6c-mutation 测试：临时修改源码为 fcd8212 回归形式，重新 AST 提取，验证测试能检测到 `!!submitRun` 作为参数的破坏形式。
- S1-6c 增加结构断言：验证提取的条件包含 `||`（短路）、`canCommitCapability`、`submitRun`，且不含 `!!submitRun`（参数形式）。
- 测试数量从 26 增至 28。

### 变异验证

| 源码状态 | S1-6c 通过 | S1-6c 失败 | 退出码 |
|---|---|---|---|
| 正常源码（`||` 短路） | 7/7 | 0 | 0 |
| 变异源码（`!!submitRun` 参数） | 1/7 | 6 | 1 |
| 恢复正常源码 | 7/7 | 0 | 0 |

变异测试临时修改 `CapabilitiesPage.tsx`，在 `t.after` 中恢复原始内容。

### 验证（工作目录 workbench/，Windows 10 / Node v24.14.0）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `node --test tests/*.test.mjs` | 1 | 204 项，202 通过，2 项预存失败 |
| `npm run validate` | 0 | 16 组件通过 |
| `npm run build` | 0 | tsc --noEmit + vite build，58 模块 |

### 未验证范围

- AST 提取测试在 Node 中执行，未在 React 组件渲染中验证（Chromium 缺失）。
- 真实 Hermes/Skill 链路、Windows/U 盘验收未执行。
- S1-9/10 仅域函数 epoch 守卫，未执行实际 end() 调用。


## 2026-09-28 P2-S1-R1 提交顺序回归修复（基于 fcd8212）

返工原因：前次修正（fcd8212）中 `canCommitCapability` 接收 `submitResult` 参数，导致 `CapabilitiesPage.tsx:22` 的调用表达式 `!!submitRun?.(next)` 在校验之前执行——提交回调先于校验被调用，构成实际生产行为回归。审查探针证实：prompt/fingerprint 不匹配时，base 提交 0 次，fcd8212 提交 1 次。

### 修改内容

**生产代码修复：**
- `src/domain/capability-run.ts`：`canCommitCapability` 移除 `submitResult` 参数，仅校验身份字段。调用方负责在校验通过后调用 `submitRun`。
- `src/pages/CapabilitiesPage.tsx`：恢复短路顺序 `if(!canCommitCapability(prepared,next)||!submitRun?.(next))throw new Error('CHANGED')`——`||` 确保 `canCommitCapability` 先执行，不匹配时不调用 `submitRun`。

**测试新增/修正：**
- `tests/s1-capability-chain.test.mjs`：新增 S1-6c 调用路径回归测试（6 项），提取 CapabilitiesPage 实际调用点表达式，用计数回调验证：
  - prompt/fingerprint/epoch 不匹配时 submitRun 调用 **0 次**
  - 全部匹配时 submitRun 调用 **1 次**
  - submitRun 返回 false 时正确报 CHANGED
  - prepared 为 null 时 submitRun 调用 **0 次**
- 移除 S1-7（复制局部门禁）和 S1-5/5b（常量比较），避免误导覆盖等级。
- S1-9/10 标注为"域函数测试"，不声称执行了实际断线或失败处理。

### 验证（工作目录 workbench/，Windows 10 / Node v24.14.0）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `node --test tests/*.test.mjs` | 1 | 202 项，200 通过，2 项预存失败 |
| `npm run validate` | 0 | 16 组件通过 |
| `npm run build` | 0 | tsc --noEmit + vite build，58 模块 |

### 回归证明

模拟 fcd8212 的错误调用路径（`canCommitCapability(prepared,next,!!submitRun?.(next))`），prompt 不匹配时 submitRun 调用 1 次。修复后调用 0 次。S1-6c 测试 `assert.equal(submitCalls,0)` 能捕获此回归。

### 未验证范围

- **浏览器真实前端接线**：本机 Chromium 缺失。调用路径测试提取了实际表达式但未在 React 组件渲染中验证。
- **真实 Hermes/Skill 链路**：未启动真实 Hermes 实例，未调用真实模型。
- **Windows/U 盘验收**：未执行。
- 2 项预存失败根因待验证，不在 S1 范围内，未修复。
- S1-9/10 仅测试域函数 epoch 守卫，未执行实际 end()/setPhase('failed') 调用。


## 2026-09-28 P2-S1-R1 证据修正（基于 f27876b）

返工原因：前次交付（f27876b）中 S1-6/S1-6b 测试复制校验逻辑而非调用生产代码；fixture 计数不等于 UI 防重复提交；文档对测试退出码和 Windows 根因描述不准确。

### 修改内容

**生产代码重构（不改外部接口）：**
- `src/domain/capability-run.ts`：新增 `canSubmitCapability` 和 `canCommitCapability` 纯函数，从 `useLiveChat.ts` 和 `CapabilitiesPage.tsx` 提取校验逻辑。
- `src/hooks/useLiveChat.ts`：`submitCapability` 调用 `canSubmitCapability` 替代内联校验。
- `src/pages/CapabilitiesPage.tsx`：`execute` commit 调用 `canCommitCapability` 替代内联校验。

**测试重写：**
- `tests/s1-capability-chain.test.mjs`：26 项测试，全部通过 transpile+import 调用真实生产代码。包含 2 项 mutation guard 测试，证明移除 epoch/fingerprint 检查时测试能捕获回归。
- `tests/browser-fixture.test.mjs`：修正测试描述，明确 fixture-level 覆盖与 UI-level 覆盖的边界。

### 验证（工作目录 workbench/，Windows 10 / Node v24.14.0）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `node --test tests/*.test.mjs` | 1 | 202 项，200 通过，2 项预存失败 |
| `npm run validate` | 0 | 16 组件通过 |
| `npm run build` | 0 | tsc --noEmit + vite build，58 模块 |

**预存失败对照（base SHA 3252643 vs result）：**
- `installer.test.mjs`（mid-install rename failure）和 `skill-catalog.test.mjs`（catalog rejects links and case collisions）在 base 和 result 中均失败，行为一致。
- **根因待验证**：此前描述为"Windows 大小写不敏感"仅为基于错误信息和环境的假设，未逐项验证根因，标注为待验证假设。
- result 比 base 多 30 项测试（202−172），即本批新增的 s1-capability-chain 26 项（替代前次 8 项）+ browser-fixture 扩展 4 项 + 其他既有测试中未在 base 出现的新增。

### 验收场景覆盖（修正后）

| 场景 | 覆盖等级 | 证据 |
|---|---|---|
| 管理/RPC 令牌隔离 | 真实 HTTP 路由通过 | S1-1：startControlServer 启动真实 loopback HTTP，fetch 验证管理令牌≠RPC 令牌、错误令牌 403、管理令牌不出现在响应正文 |
| prepareCapabilityRun 发送管理令牌 | 真实生产代码通过 | S1-1b：transpile+import 真实 capability-run.ts，mock fetch 捕获 Authorization header |
| Skill 变更后二次核验拒绝 | 真实服务函数通过 | S1-4/S1-4b：真实 prepareCapability + 临时文件，修改后第二次抛 CHANGED |
| canSubmitCapability epoch/port/token 不匹配 | 真实生产代码通过 | S1-6：transpile+import 真实 canSubmitCapability，测试 epoch/port/token/null access 全路径 |
| canCommitCapability 不匹配 | 真实生产代码通过 | S1-6b：transpile+import 真实 canCommitCapability，测试 epoch/port/token/prompt/fingerprint/null/submitResult 全路径 |
| Mutation guard（测试捕获门禁被破坏） | 通过 | S1-6-mutation/S1-6b-mutation：模拟移除 epoch/fingerprint 检查，证明 broken gate 允许通过而 real gate 拒绝 |
| 重复点击防重入（submitText streaming guard） | 条件逻辑测试 | S1-7：测试 submitText 的 streaming 状态门禁条件。**未在真实浏览器中验证 UI 行为** |
| 迟到响应丢弃（generation/controller guard） | 条件逻辑测试 | S1-5/S1-5b：测试 generation 和 controller 不匹配时丢弃。**未在真实浏览器中验证 UI 行为** |
| 断线后不重放（epoch 递增） | 真实生产代码通过 | S1-9：canSubmitCapability 在 epoch 递增后拒绝旧 draft |
| submitText 失败后阻止重发 | 真实生产代码通过 | S1-10：end() 递增 epoch 后 canSubmitCapability 拒绝旧 draft |
| 管理请求失败/认证失败/非法响应 | 真实 HTTP 路由通过 | S1-8/S1-8b：缺认证 403、错误令牌 403、额外字段 400、非 JSON 400、超大 body 400 |

### 未验证范围

- **浏览器真实前端接线**：本机 Chromium 缺失。S1-7/S1-5/S1-5b 仅测试条件逻辑，未在真实浏览器中端到端验证 UI 行为。
- **真实 Hermes/Skill 链路**：未启动真实 Hermes 实例，未调用真实模型。
- **Windows/U 盘验收**：未执行。
- 2 项预存失败根因待验证，不在 S1 范围内，未修复。

### 隐私与安全

- 管理令牌不出现在 API 响应正文中。
- prepare 响应返回的 RPC 令牌与管理令牌不同。
- CSP 阻止外部连接。
- 合成 fixture 使用 `fixture-manager-token` 和 `fixture-rpc-token`，不含真实凭据。


## 2026-09-23 P2-S1-R1 卡片调用链浏览器复验与定向返工（前次，已被上方修正替代）

- 基线 SHA：3252643887c61489ef3cfc6b1a2457a968ee3ab2
- 环境：Windows 10 / Node v24.14.0 / MSYS bash
- 新增测试文件：`tests/s1-capability-chain.test.mjs`（8 项）、`tests/s1-control-server.mjs`（浏览器服务启动器，未纳入自动测试套件）、`tests/s1-browser-launch.mjs`（同前）。
- 修改测试文件：`tests/browser-fixture.test.mjs`（+4 项）、`tests/browser-rpc-fixture.js`（新增 prepare 端点模拟）。
- **npm test**：184 项测试，182 通过，2 项预存失败（`installer.test.mjs` 中 `mid-install rename failure` 和 `skill-catalog.test.mjs` 中 `catalog rejects links and case collisions`）。两项失败均为 Windows 文件系统大小写不敏感导致，与本批 S1 范围无关，未在本批修复。
- **npm run validate**：16 个组件文件通过，退出码 0。
- **npm run build**：tsc --noEmit + vite build 通过，58 模块转换，退出码 0。

### 验收场景逐项结果

| 场景 | 结果 | 证据 |
|---|---|---|
| 管理/RPC 使用不同端口与令牌 | 通过 | S1-1a~f：管理令牌通过管理 API，错误令牌 403；prepare 返回 RPC 令牌 `fixture-rpc-token` ≠ 管理令牌；状态响应不含管理令牌；CSP 阻止 `https://*` |
| 准备完成但未确认，prompt.submit 次数为 0 | 通过 | S1-2：prepare 响应无 submitted 字段；S1-fixture-3：prepare 不触发 WebSocket RPC（`__p2RpcRequests.length===0`） |
| 确认后连续重复点击只新增一次 prompt.submit | 部分覆盖 | S1-fixture-4：合成 WS 追踪 prompt.submit 计数。前端 `execute` 在 `request.current` 存在时直接 return（防重入），此逻辑由代码审查确认，浏览器端到端点击测试因 Chromium 缺失未执行 |
| 准备后确认前修改 Skill → 二次核验拒绝 | 通过 | S1-4：修改 skill 脚本文件后第二次 `prepareCapability` 抛出 `CHANGED`；S1-4b：未修改时两次指纹一致 |
| 延迟准备响应后切换卡片或重新导入 | 代码审查通过 | `choose()` 调用 `request.current?.abort()`，`load()` 递增 `generation.current`，迟到响应通过 `if(id!==generation.current)return` 丢弃。浏览器端到端验证因 Chromium 缺失未执行 |
| 延迟二次核验时切换实例/令牌/连接代次 → 拒绝旧请求 | 通过 | S1-6：`submitCapability` 校验 epoch/port/token，任一不匹配返回 false；S1-6b：`execute` commit 路径校验 epoch/port/token/prompt/fingerprint，不匹配抛 `CHANGED` |
| 二次核验期间断线，随后释放响应或重连 → 不提交不重放 | 代码审查通过 | `useLiveChat.end()` 递增 epoch 并关闭连接；`submitText` 失败时 `end()` + `setPhase('failed')`；`submitCapability` 校验 `draft.epoch!==epoch.current` 阻止旧提交。浏览器端到端验证因 Chromium 缺失未执行 |
| 管理请求失败/认证失败/响应非法 → 清除审阅，错误可见 | 通过 | S1-8a~e：缺认证 403、错误令牌 403、额外字段 400、非 JSON 400、超大 body 400、外部 Origin 403。前端 `execute` catch 块设置 `setError(true)` 并清除 prepared/confirmed |

### 隔离真实 HTTP 路由验证

- 使用 `startControlServer` 启动真实 loopback HTTP 管理服务（端口随机分配），通过 `fetch` 执行 12 项 HTTP 级验证，全部通过。
- 管理服务使用 `timingSafeEqual` 比较令牌，CSP 阻止外部连接，Origin 校验阻止跨站 POST。
- 证据为隔离合成数据，未调用真实 Hermes 或模型。

### 未验证范围

- **浏览器真实前端接线**：本机 Chromium 缺失（`npx agent-browser install` 未执行，不安装新依赖）。上述 UI 行为（重复点击防重入、延迟响应丢弃、断线不重放）通过代码审查和合成 fixture 测试覆盖，但未在真实浏览器中端到端验证。
- **真实 Hermes/Skill 链路**：未启动真实 Hermes 实例，未调用真实模型。
- **Windows/U 盘验收**：未执行。
- 2 项预存失败（installer/skill-catalog）不在 S1 范围内，未修复。

### 隐私与安全

- 管理令牌不出现在 API 响应正文中。
- prepare 响应返回的 RPC 令牌与管理令牌不同。
- CSP 阻止 `https://*` 外部连接。
- 合成 fixture 使用 `fixture-manager-token` 和 `fixture-rpc-token`，不含真实凭据。


## 2026-09-21 dff159b 定向审查修复

- 审查对象：aecd17d22e225e1ecae7b9ce3744cdad8218c8e3..dff159bed2c275d1b6a9c7c0c04c5b7bddf58bda。
- 修复基线：8fe984314d1290e9f980b1ab002cdb4eb9118f29，先在 detached worktree 修复验证；用户随后授权修复并推送，核对远端仍为同一基线后将受控补丁应用到 feat/portable-initializer。未发布安装包或更新真实实例。
- 原提交的 RPC/管理服务混用、确认只信缓存指纹、更新定时器模拟结果、虚构恢复状态接线已在整合基线替换或撤下；仅静态复核，不声称完成浏览器竞态验收。
- 本次修复：证据写入前按 schema 投影（含嵌套 checks），拒绝非法记录且不覆盖旧值；存储读取拒绝时安全返回空；保留并排除 trusted:false 证据，禁止其授予 verified；兼容性 unknown 不允许安装；没有观察到未完成工具也保留恢复可能继续执行警告。
- 浏览器夹具改为严格同源/测试管理令牌/GET/精确路径，尊重已取消信号，不记录请求令牌；无真实后端的 evidence/prepare 明确 404，未知请求不透传。该夹具不是卡片执行整合测试。
- 测试先红后绿：领域针对性回归初次 42 项中 5 项失败，修复后 42 项通过；夹具新增 2 项初次均失败，修复后通过。
- 最终 Linux / Node v24.15.0：npm test 172/172，npm run validate 16 个组件，npm run build，git diff --check，逐条退出码均 0。
- 补丁应用回原开发工作区后再次独立运行 npm test、npm run validate、npm run build，分别为 172/172、16 个组件、构建通过，退出码均 0；未使用旧 dist 冒充本次产物。
- 全量测试包含真实 loopback 管理 HTTP 路由与合成实例回调，不启动真实 Hermes/模型；存储测试为内存 backend，安装/目录测试使用临时合成文件，不读取个人实例。
- 未验证：真实浏览器端到端、真实 Hermes/Skill 执行及模型审批、Windows/U盘；历史失败不能由本次 Linux 结果关闭。
- 遗留边界：environmentFingerprint 仍只是未接入的目录摘要，不能作为机器/依赖证明；localStorage 模块未接 UI，也不是实例库；可信证据采集、真实更新和恢复后端仍未完成。不通过补功能扩大此次审核范围。
- 审核结论：原交付需返工，本次上述修复自动回归通过，整合业务闭环待环境验证；release_ready:false 不变。

## 2026-09-21 单分支整合验证（当前优先）

- 整合 dff159b 与 190cc89 到 feat/portable-initializer，保留双方提交历史。
- Linux：npm test 167/167 通过；npm run validate 16 个组件通过；npm run build 通过，均退出码 0。
- 修复 ServiceControls 学习来源接线和 learn 文案的两处 TypeScript 错误。
- 新增学习来源投影/未完成轮次边界及设置页服务端渲染测试；未接后端显示不可用，不假报检查成功。
- 采用管理服务准备和提交前二次重核；外部独立模块/测试保留不代表已经接通业务。
- 未执行浏览器整合、真实模型、Windows/U 盘验收；历史探针未重跑。
- release_ready 仍为 false，遗留问题与下一批见 HANDOFF；本轮不发布安装包。
- 以下均为此前代码现场/历史记录，不代表当前仍未合并或构建失败。

## 2026-09-21 Git 检查点复核

- 本机 WIP：115/115 Node 测试通过，16 个组件检查通过。
- 生产构建仍有前次记录的两处 TypeScript 错误；保存检查点不代表构建/发布通过。
- fetch 后原远端开发分支仍为 dff159b；使用独立 handoff/p2-local-checkpoint-20260921 保存，不强推或合并。
- 未执行真实模型、Windows/U 盘测试，未修复或关闭 dff159b 审查问题。

## 2026-09-20 交接现场核查（历史）

范围：本机 aecd17d + 未提交 P2 增量，不是 dff159b。Linux / Node v24.15.0。
本轮仅整理文档与必要引用/打包白名单，不合并或修复业务代码。
- npm test：115/115 通过。
- npm run validate：16 个组件通过。
- npm run build：退出码 2；ServiceControlsProps 缺少 selectedLearningSource 接线，
  taskCapabilityCopy 缺少 learn 字段，均见 HANDOFF。
- 没有浏览器整合、真实模型、Windows/U 盘验收，也未重新运行历史隔离探针。
- 文档归并后：13 份文档的本地链接与包白名单检查通过；旧文档路径不再允许打包。
  package/installer 的 9 项针对性回归通过；这些测试使用合成文件，不是实际安装验收。
  所有文档采用明确白名单随开发包携带，没有改为允许任意 docs 路径。
  git diff --check 通过。本轮没有使用旧 dist 生成交付包，不能推导发布通过。

## dff159b 独立审查（前次记录，非本轮复跑）

151/151 Node 测试、16 个组件检查和生产构建通过；六项审查问题见 [HANDOFF](HANDOFF.md)。
没有整合进本机 WIP；外部报告中的 Windows 失败仍待原生环境复核。
不把两套测试数量相加，不把该提交通过结果用来遮盖当前构建失败。

## 历史批次记录（保留证据，不覆盖上述当前状态）

2026-09-13 任务关联增量：115 项测试、16 个组件检查及生产构建通过。
卡片提交现在将 cardId/methodFingerprint 作为本轮结构化元数据保存，工具和消息事件不能
覆盖它；前一轮归档保留关联，下一次普通聊天不继承。任务中心直接显示关联和“业务未验证”。
新增手动任务观测报告导出：最多 100 轮/256 KiB，只投影会话、状态、卡片指纹、工具标识/状态，
不输出回复正文、输入参数、工具结果或令牌，明确 trusted_verification:false。
4 项测试覆盖关联投影/终态/不继承、错误身份拒绝、报告隐私投影及限额/不变性。
报告只是可携带诊断快照，不是可信证据持久化、恢复入口或验证证书；新增报告下载和任务元数据
展示尚未做浏览器/Windows 验证，不沿用前一批按钮测试作本次 UI 通过证据。

2026-09-13 卡片客户端增量：111 项测试、16 个组件检查和生产构建通过。
新增 4 项客户端测试覆盖固定认证端点、字段投影、UTF8 限额、错误身份/响应拒绝；
导入新文件立即清空旧审阅，并在读取期间拒绝执行；更换管理令牌/管理请求失败清除共享令牌。

browser-act 独立会话 p2-cap-run，生产构建配合合成管理器及 RPC：
- 准备后只有 session.create，未确认时发送按钮禁用。
- 勾选确认后同一按钮同步点击两次，累计只有一次 prompt.submit，审阅清空且显示已提交。
- 人为延迟准备响应并切换卡片，释放迟到响应后不显示旧审阅、不追加提交，参数清空。
- 确认的第二次核验响应被延迟时触发 WebSocket close，随后释放响应，提交总数仍为 1，
  显示错误且清空审阅。
测试浏览器与合成管理器均已关闭，没有真实模型/工具或个人 Skill 操作。
这些交互证据来自上述导入/令牌收紧补丁之前的构建；补丁已编译及自动回归，新增边界交互仍需补测。
未覆盖真正重连至另一实例、实际 Skill 读取执行、Windows 或业务验证，不能宣布全闭环通过。

2026-09-13 开发增量：单 Skill 请求准备与确认提交已接代码；107 项测试、16 个组件检查、
TypeScript 与生产构建通过。新增 4 项准备器测试及 1 项管理接口测试，覆盖方法变化、参数
边界、Bundle 拒绝、只读准备、认证与实例就绪门禁；尚不覆盖前端防重复提交整合行为。
管理接口只接受 card/values，重读固定实例的 Skill 子树并匹配指纹，不接受浏览器扫描路径。
前端先审阅，确认时再核验一次，检查前后请求、方法指纹、端口/令牌和连接代次；同一在途
操作不重复发送。提交后进入现有真实聊天/任务事件链，用户请求记录含卡片 ID 和方法指纹。
使用普通任务 prompt 明确要求 Hermes 用工具读取指定 Skill；不是斜杠命令分发或预先加载方法。
Skill 不可用时要求停止/说明，不自动替换。提示不是安全沙箱，也不能原子锁定 Agent 读取时
的目录内容；实际执行、审批和业务证据仍需整合验证。Bundle、持久化、发布均未完成。
本增量尚无浏览器或 Windows 证据，不将编译/单元测试当作完整闭环验收。

此前增量（2026-09-11）：`npm test` 共 102 项通过，16 个组件检查和生产构建通过。

实例 Skill 目录增量：认证管理接口只扫描启动时固定的 home/skills，不加载用户代码，
按定义及脚本等完整子树计算指纹。管理面板新增导出未验证草稿入口，导出后可在能力页导入。
新增 5 项测试覆盖指纹稳定/脚本变化、正文不外泄、链接/大小写碰撞/大小限制、认证与就绪门禁、
前端响应限额和强制草稿投影。未读取个人 Skill；浏览器下载交互和 Windows 目录行为仍待验。
扫描不等于 Hermes 可用性判定，不包含外部 Skill/Bundle；也未完成真实卡片调用或证据持久化。

学习请求增量（前一批 97 项）：指纹锁定的上游 learn_prompt 纯构造器，经认证管理 API 准备，
UI 展示范围/全文并要求确认，再提交当前连接；不经 command.dispatch，不自动执行或发布 Skill。
隔离探针 learn_prompt_prepared、learn_builder_fingerprint 均 true。
合成浏览器会话 p2-learn-review：准备时只有 session.create，确认前按钮禁用，确认后仅新增
一次 prompt.submit，审阅区清空。未调用真实模型或写入 Skill；实际产出及权限边界仍待验。
管理器 CSP 补充仅本机 HTTP 连接源以支持历史读取；该修复不替代历史页浏览器 CORS 验收。

历史正文只读入口增量：索引列表可主动查看最近 50 条，GET 固定消息端点，不调用 resume。
请求带 Authorization，禁用 Cookie、重定向和缓存；校验会话 ID 防止路径穿越，响应流限制
1 MiB，单条展示 20,000 字符、总计 100,000 字符。隐藏/工具/非文本消息剔除，额外字段不保留。
15 秒超时；关闭正文、断开或重连取消在途读取，迟到响应不得覆盖新状态；正文仅留页签内存。
新增 4 项测试覆盖投影、限额、固定只读请求、敏感错误隐藏与非法路径拒绝。
Linux bwrap 探针新增 history_http_read、history_http_unauthenticated_rejected、
history_local_origin_allowed 三项均 true，原有检查仍通过，退出码 0，隔离服务已退出。
该证据不覆盖浏览器 CORS 预检、正文按钮交互、Windows、实际个人历史或会话续跑；仍待验。

真实任务中心增量：`/tasks` 改为展示当前连接观察到的会话轮次与工具活动，模拟流程移至
`/tasks/demo`。没有收到真实事件时显示空态，不填充示例成功任务。完成状态明确标为模型
轮次完成，不推断业务验证；断线运行状态为未知。停止按钮复用 session.interrupt。
聊天 hook 提升到 App，聊天/管理面板保持挂载但离页隐藏，内部切页不重建连接或丢管理令牌。
刷新与重连仍清空记录，没有实现持久化历史或跨页签共享。新增 2 项状态投影测试通过。

browser-act 独立会话 p2-tasks-review 的生产构建测试，注入合成 RPC（无真实 Hermes）：
主动连接、发送 hold，切到任务中心，注入 tool.start 后显示运行中和 terminal 正在调用。
请求记录只有一次 session.create 和一次 prompt.submit，socket 未关闭。
任务中心点击停止仅增加一次 session.interrupt，收到终态后显示中断及工具结束未知；
返回聊天保留“测试已停止”，未新增会话或关闭连接。浏览器与预览服务已关闭。
这是合成协议交互证据，不代表真实模型、Windows、管理令牌往返或完整键盘测试通过。

Profile 摘要增量：真实连接页主动读取 profiles.list(include_sessions:false)，仅保留名称、
显示名、默认标志、模型、提供方和技能数量；不展示路径、提示词、会话摘要和额外元数据。
最多 100 项，拒绝重复身份/损坏字段，null 模型与提供方显示未配置。2 项测试通过。
Linux bwrap 隔离真实接口探针新增 profiles_list_shape / profiles_exclude_sessions 检查：
首次因未配置模型返回 null 而失败，修正解码与探针后两项均 true，原有探针检查仍通过，
退出码 0。没有个人配置、外网或真实模型/工具访问，隔离子进程已经退出。
该面板的浏览器交互、多 Profile 与 Windows 实测仍待完成，不沿用草稿页的浏览器证据。

草稿保存增量：导出仅包含经过 schema 投影的卡片定义，强制 draft，不含运行参数、审批、
额外字段或验证证据；不改写原对象。导入/导出共同限制 UTF-8 64 KiB、100 张、唯一 ID。
新增两个测试覆盖往返导入、隐私字段剔除、中文多字节超限、重复和空集合。

本地生产构建浏览器检查（独立 hermes-p2-preview / p2-card-review）：

- 使用 tests/capability-browser-fixture.json 两张合成卡片，外部 published 状态降为草稿。
- 空必填输入的表单无效，未出现预览；填写合成参数后显示正确预览，真实执行仍禁用。
- 点击导出，捕获实际 Blob 内容：两张卡片均为 draft，不包含本次合成输入或 evidence。
  此证据检查浏览器生成的下载内容，不声称已验证 Windows 下载保存位置。
- 切换卡片清空输入与预览；当前桌面视口无水平溢出。
- 刷新恢复空态且导出禁用；未调用真实 Hermes、模型或工具。测试会话已关闭。

窄屏、高 DPI、键盘全流程、实例能力库和真实执行不在本轮浏览器证据范围内。

`/capabilities` 新增“我的能力”开发页：空态、用户选择 JSON 后本页导入草稿、卡片选择、参数
填写与预览。只读选中文件，不上传；外部发布状态强制降为草稿，证据和未知字段丢弃。
最多 64 KiB/100 张，成功导入替换本页内容，离页/刷新清空。执行按钮禁用：实例能力库、
依赖/方法指纹核对、真实调用和持久化仍未接入。这是向正式卡片入口推进的增量，不是最终交付。
导入规则和上述桌面浏览器交互已验证；完整视觉与实机矩阵尚未验证，不以编译代替验收。

能力卡片新增纯数据模型（定义已连接草稿界面，验证证据尚未连接存储）：目标、输入声明和 Skill/Bundle 内容指纹，
不含调度指令。验证记录要求具体检查项，绑定会话、方法和环境；草稿不因证据变成已发布，
版本/环境改变要求复验，同时间冲突或较新失败不能被旧成功掩盖。5 项新增测试通过。
这里只验证数据判断逻辑，不能认证外部传入证据的真实性；证据采集与业务验证仍待接线。

只读接口真实探针：独立 bwrap 内运行 Hermes，skills_list_shape、learn_registry_resolved、
discovery_tool_not_started 全 true，原认证/空会话/缺 Provider 失败检查仍通过，退出码 0。
不读取个人 Skill，不调用 command.dispatch 或学习/安装，不将此记作实际 /learn 已完成。

会话索引增量按开发机 `methods_session.py` 的 session.list 返回格式接线：用户主动读取最多
50 条，保留 ID、标题和消息数，丢弃 preview 和未知字段。2 项解码测试覆盖边界与重复 ID。
尚未在真实个人会话上执行，不把源码核对和解码测试记为会话恢复通过。
源码显示 session.resume 可调用 `_maybe_schedule_auto_continue`，因此不能把恢复按钮当成只读
浏览；后续必须明确告知潜在继续执行并核对恢复语义，当前未接入 resume。

聊天历史现在保留前一轮完整的显示状态（回复、失败/中断、工具活动及截断标记），不再在下一次
发送时只保存回复文本。工具记录可折叠，仍只保存在当前页面内存中，刷新或重新连接不恢复。
新增测试证明下一条消息不会改写上一轮失败和未知工具状态，也不能归档尚在执行的轮次。
新版组件的浏览器交互、长会话与持久化仍未验收。

真实连接页新增本轮工具活动：依据开发机 `tui_gateway/server.py` 的 `tool.start` / `tool.complete`
字段，以 tool_id 关联名称和耗时；“调用结束”不推断成成功。终态前未收到工具结束事件的活动
保留为未知，断线也不表示取消或回滚。最多保留 100 条，不储存原始 args/result。
3 项新增单元测试覆盖关联、乱序/跨会话拒绝、未知终态和显示上限；页面真实工具执行与浏览器
交互仍待整合验证，当前仅为协议源码核对、单元测试与构建证据。

安装器测试在临时目录中验证只读预检、外壳备份、配置哨兵与原启动器不变、篡改包拒绝、
私人数据路径拒绝、活动实例锁阻止安装。没有安装到开发机个人 Hermes 或 U 盘。
新增故障注入验证：中途替换失败会恢复已写入外壳；回退也失败时保留备份和活动安装标记，
再次安装被拒绝。启动入口也检查该标记。真实断电恢复及 Windows 文件占用行为尚未验收，
恢复入口已加入，只读核对全部备份和目标后，显式确认才恢复。故障注入测试还验证后续用户修改、
损坏备份和活动锁均拒绝恢复；清洁现场恢复成功才移除标记，保留备份。
这不证明真实断电或 Windows 文件占用场景已经通过，不能手动删除标记冒充恢复完成。

Windows Job Object 测试补充“管理器管道断开”场景，与“宿主被终止”场景共同检查子进程和
孙进程回收。当前 Linux 执行结果为 2 项跳过，不记作 Windows 通过。

## 管理页面整合检查（2026-09-09）

browser-act 在独立空白 Chrome 运行生产页，由真实 control-server HTTP 提供资源和 API；
startInstance 与 WebSocket 使用无副作用夹具，没有启动真实 Hermes。
观察：URL 中控制令牌被移除；读取状态后管理密码框清空、idle 允许启动；
点击启动后显示服务就绪并发送一次 session.create；停止在未勾确认时禁用。
勾选并停止后管理状态回 idle、聊天连接关闭、socket.closed 为 true、确认框复位，密码框均空。
测试浏览器和夹具服务均已关闭（进程退出码 0）。这不代替真实模型或 Windows 验收。

## 打包演练（2026-09-09）

`build-p2-package.mjs` 使用固定入口白名单加 dist 资源，不包含 data、runtime、node_modules 或测试夹具；
每文件记录 SHA-256 和长度，拒绝链接及未知构建文件，输出目录必须新建。
本轮在 `/tmp/hermes-p2-package-check-MgWAbW/output` 生成包含 19 个载荷文件的开发快照 ZIP，
`unzip -t` 全部通过。包状态固定 development-snapshot、release_ready:false，不作为集中验收交付。
仍需安装器、完整清单、最终内容核对及 Windows 验收，后续代码变化需重新构建打包。

真实管理器集成探测也已通过：认证健康、错误令牌拒绝、单实例拦截、受控停止和锁释放均 true，
详见 [服务生命周期](ENGINEERING.md#lifecycle)。仅在 Linux 隔离环境验证，没有模型或工具操作。

后续控制 HTTP 集成探测也通过：未认证启动拒绝、API 启动就绪、显式本机 Origin 的 WebSocket
握手成功、外站 Origin 拒绝、API 停止回到 idle、锁释放。测试客户端模拟浏览器 Origin，
不把它误算成真实浏览器页面验收。

进程生命周期增量在 Linux 启动独立 Node 假服务：就绪标记后仍需探针确认、启动超时停止、迟到确认不复活、探针异常不泄漏原文、提前退出/非法端口拒绝、停止幂等，以及停止一个实例不影响另一个。不是实际 Hermes 或 Windows 进程树验收。

审批增量：验证仅暴露 once/deny、绑定具体 request_id、all:false、拒绝缺失或超限字段、遵守 deny-only、只有 resolved:true 才视为答复确认。页面使用纯文本展示命令，不渲染 HTML。答复结果未知时断开，不重发授权。上述为单元测试与编译证据，真实工具审批和页面端到端尚未验收。

真实连接实验页已完成下述假服务浏览器交互检查；尚无页面与真实 Hermes 服务的端到端验收。

## 真实连接实验页：浏览器假服务检查（2026-09-08）

使用 browser-act 和已有独立空白 Chrome，打开生产预览 `/chat/live`。
注入 `workbench/tests/browser-rpc-fixture.js` 替换 WebSocket；不接触真实服务、模型或工具。
本轮观察结果：

- 输入测试令牌并主动连接，握手/创建会话后允许发送；密码框已清空。
- `hello` 显示完整测试回复及完成状态。
- `approve` 展示命令、原因及两个按钮；拒绝发送 `choice:deny`，再次测试批准发送 `choice:once`。
  两次均绑定 `session_id:p2-browser`、`request_id:approval-1` 和 `all:false`，无 session/always 授权按钮。
- `hold` 保持流式状态，文本为“分段回复”，输入禁用；点击停止只发送一次 interrupt，
  收到 interrupted 终态后显示“本轮已中断”并恢复输入。
- 再发送 `hold`，注入 close 事件：显示运行结果未知、输入禁用、假 socket 已关闭；
  请求记录共 5 次 prompt.submit、1 次 interrupt，没有因断线自动重发或把断线当作取消。

这是实际 React 页面配合合成传输的交互证据，不证明真实模型回复、权限执行或 Windows 兼容性。
测试结束关闭本轮独立浏览器会话。夹具仅位于 tests，不随生产入口加载。

新增 WebSocket 假传输测试覆盖：open 不等于 ready、就绪后发送、断线清理、忽略迟到事件、
损坏报文、握手超时、主动关闭，以及连接前拒绝远程地址。尚未证明浏览器与真实服务的整合。
RPC 单元测试使用合成报文。另有 Linux 隔离服务探针验证认证拒绝、ready 和未知方法错误，退出码 0；详见 [协议证据](ENGINEERING.md#protocol)。仍不能证明会话、取消和网络恢复已可用。

后续空会话增量已通过：创建、隔离 cwd、关闭、重复关闭 false、关闭后取消错误 4001。
未提交 prompt，尚未验证流式回复、运行中取消、审批或断线恢复。隔离服务已退出。

再后续缺失配置失败探针已提交固定测试 prompt：收到真实终态 error 事件，未出现 tool.start，
握手和关闭检查仍通过，退出码 0。全程隔离外网且没有真实 API 凭据，不证明成功模型流已通过。

请求生命周期测试覆盖乱序响应、事件分流、断线拒绝全部等待项且不重发、超时后的迟到响应、
损坏报文、上游错误正文不外泄、发送异常及同步响应清理。真实网络与认证仍待隔离实测。

环境：当前 Linux 开发电脑，独立空白 Chrome 环境 `hermes-p2-preview`，
生产构建通过 `127.0.0.1:4173` 预览。未导入登录信息，未连接真实 Hermes。

## 已通过

- `npm run build`：TypeScript 与 Vite 生产构建成功。
- `npm run validate`：10 个组件/页面 AST 结构检查成功。
- 10 个导航入口：页面标题与路径匹配，唯一活动导航，当前桌面视口无水平溢出。
- 聊天演示：输入后发送，出现用户文本与明确标记的演示回复；输入清空后发送禁用。
- 旧固定任务页：待审批→执行→完成；执行→失败→模拟回滚；待审批→取消。此证据不覆盖后续定义驱动任务页。
- 资源仓库：输入“诊断”只显示一个匹配示例，详情明确提示后端待接入。
- 初始化向导：从第一步推进到第六步，最后一步不能继续推进。
- 明暗主题切换；查看首页亮色、聊天暗色截图确认布局。
- 更新中心两个真实检查按钮禁用，不误报执行成功。

## 本轮修复

状态样式使用动态拼接类名，Tailwind 生产构建没有保留颜色规则。
改用完整静态类名映射后重新构建并复测：完成状态显示青绿色，而不是灰色。

## 不包含

未完成窄屏、多浏览器、Windows 高 DPI、完整键盘/读屏、中英文切换、
真实 API/流式输出、后端进程管理或 U 盘便携发布验证。本记录不代表 P2 完成，
也不替代 P0 实机验收。
# 工作流定义驱动增量验证（2026-09-08）

- `npm test`：5 项纯状态引擎测试通过，覆盖逐步推进、审批不可跳过、取消保留已完成步骤、不同步骤结构、失败终止、定义版本不匹配和原记录不被修改。
- `npm run validate`：10 个组件/页面结构检查通过。
- `npm run build`：TypeScript 与 Vite 生产构建通过。
- 本轮没有完成浏览器复测，不沿用上方旧固定流程的浏览器证据证明新版界面已通过。
- 两个定义均为模拟草稿，未验证真实系统执行、输入绑定、分支、持久化、跨电脑授权或回滚。

## 参数绑定与新版浏览器增量验证（2026-09-08）

- `npm test`：6 项通过，新增必填输入阻止启动、参数副本、执行后锁定、重置清空测试。
- `npm run validate`：11 个组件/页面通过；TypeScript 和生产构建通过。
- 在已授权的独立 Chrome 预览会话重新加载新构建：空输入时开始按钮禁用，填写三个虚构值后启用。
- 打印机流程逐步推进至第三步审批：参数和工作流选择锁定；审批卡显示本次三个输入值。
- 审批处取消：前两步保持已完成，第三步取消，第四步待执行，日志保留。
- 切换文档归档后展示其独立三步，输入清空且开始禁用。当前桌面视口没有水平溢出。
- 这不证明真实环境参数校验、跨机权限、存储或恢复。模拟任务离页/刷新丢弃仍是明确限制。
