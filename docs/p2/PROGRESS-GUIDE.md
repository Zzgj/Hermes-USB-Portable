# P2 当前进度与任务

## 当前交付请求：bete0.0.1新安装基线（获批回归通过，待制包）

总监已批准集中验证与制包批次。修正版冻结上三条命令各一次实际完成：Node语法检查退出0，六文件Node回归53/53、Python helper/caller20/20，均无失败或跳过、退出0，源码前后身份不变。证据见 `evidence/p2-bete001/results.json` 与对应日志；此段覆盖以下本批“待批准/未执行回归”历史状态。仅Linux隔离、合成命令/归档，不是Windows或真实依赖安装。下一步为同批已批准的固定干净提交、dev/lead同步、真实制包及独立ZIP核验；包尚未生成，不宣称完成。

修正增量独立复审 `deleg_73dd8532` 结论：静态通过，无本轮增量返工阻塞。lead已核对复审涉及八文件的工作区字节与修正版冻结identity一致。复审确认旧P2必选项/恢复契约不扩大，首次安装版本由tracked manifests复制，schema严格类型及针对性断言成立。仅源码审查，不是运行通过：新增回归、制包及Windows验收均未执行，继续等待总监对已列集中批次的批准，不自动推进测试或发布。

独立静态审查 `deleg_2561d6cb` 指出共享packageFiles扩展会使历史P2包/恢复清单缺少新版本文件而被拒绝，也可能在旧内核上覆盖首次安装版本身份。lead核对调用方后已移除该扩展；package-policy、build-p2-package、install-p2-package三份文件与基线原字节一致。首次安装继续通过真实tracked manifests复制版本文件；补正native-experiment的ls-files替身并增加落盘逐字节断言，P2包测试显式保证该身份文件不进入增量包。同时统一Python schema数值1校验，拒绝true，并补边界断言。修正版冻结identity `1fdf474a99ca384eeec0aad18c554f6e4e139ff25bd30f2fc6d579c10ec77788`；尚未运行回归或制包，不以修正代码等同已验关闭。

总监确认推荐分发方式，明确不需要获取旧U盘安装包，直接生成新安装包，名称严格为 `bete0.0.1`。此要求覆盖下方旧盘识别前置和分发待选描述；不格式化、不访问旧盘，不把桥接迁移作为本批阻塞。

实际接手HEAD仍为 `352f279c9d52ead08cfec7f0486976ad8124b946`。工作区已有版本清单、builder命名、installer版本与源码/落盘一致性校验、package-policy版本文件传递及对应Python/Node测试增量；本轮保留并核对，不把既有19项通过继承到变更后源码。版本为测试渠道，updateCapability仍unavailable，外壳升级实现未完成。新包不能冒充支持在线升级或Windows已验。

本批验收目标：固定源码提交；版本在发布清单、ZIP根目录/文件名、包清单和安装回执中一致；来源/落盘版本不一致须失败；复用既有锁定材料生成新ZIP并核验精确清单、源码字节、CRC和哈希。首次联网流程仍需固定源码可从origin获取，开发分支同步不等于发布Release。先独立静态审查，再由总监决定新增lead隔离验证/制包批次；未执行前不记通过。暂不重装任何真实实例，不新增依赖或运行Windows二进制/模型。

## 当前优先任务：P2-SHELL-UPDATE-14（需求与现状核对，未实现）

总监要求优先解决已部署U盘每版格式化/重装的问题，完成外壳更新和批次版本标识；询问本机Linux服务器与GitHub分发选型。本轮只读核对基线 `352f279c9d52ead08cfec7f0486976ad8124b946`，保留ONLINE-BUILD-13未提交测试与证据。SettingsPage更新按钮仍禁用；update-check仅领域模型；install-p2-package已有白名单、实例锁、哈希校验、备份及中断恢复基础，但不是完整可信在线升级器，不据此对未知旧实例放行。

优先工作包目标：旧实例只读识别 → 外壳版本/来源/兼容契约 → 固定制品检查与暂存 → 显式确认、停止证明与备份 → 白名单文件替换及启动检查 → 失败恢复/中断恢复 → 更新页真实状态。核心由lead亲自负责，生产实现与测试尚未开始。

- 分层边界：不格式化，不清空目标，不覆盖个人配置/凭据/Skills/会话/知识和用户数据，不默认更新Hermes或Python/Node/依赖；内核不兼容时明确阻止，仅另行规划最小迁移。旧版无更新器时需要一次经过验证的桥接安装，不要求全盘重装。
- 分发建议待总监确认：Linux开发构建；GitHub Release提供固定版本制品/清单/来源证明；离线导入复用同一验证器。禁止U盘直接git pull开发分支；未经授权不启用本机监听或公网服务器，不发布Release。来源校验不能只依赖与包一同下载的自述哈希。
- 版本策略待锁定：每个独立验收交付批次对应唯一版本、固定源码SHA、包哈希、更新说明和兼容范围；区分测试/稳定渠道。同版本不换字节，失败或未验开发检查点不自动进入用户更新渠道。尚未分配或发布新版本号。
- 必测场景：正常跨版本升级、用户数据逐字节保留、活动/未知进程拒绝、重复/并发请求、损坏或错误来源、路径穿越/链接、低磁盘空间、下载中断、写入失败、进程终止、恢复及升级后启动失败。Linux合成回归与Windows/U盘断电/文件占用验收分开，lead执行前仍列明批次报批。
- 待取得：旧U盘原安装包名或可见版本（不含配置/凭据）；必要时提供只读布局/身份诊断。未取得真实身份前不能称可直接原地升级；本轮未操作真实U盘、未运行测试、未改变现有候选包。

## P2-ONLINE-BUILD-13：本机完整builder回归，获批19项通过

用户明确公司reviewer暂不可用，先开发测试其他内容。本批暂停远端请求和依赖Windows的执行，选择与其隔离的完整打包调用链覆盖。基线 `352f279c9d52ead08cfec7f0486976ad8124b946`，仅新增 `workbench/tests/test_online_package_build.py`，不改生产源码、依赖、包或release_ready。

新增六个用例实际调用生产build：输出ZIP/manifest/省略记录/源码字节/外层校验；最后一份归档尺寸或哈希异常须在所有提取前拒绝；已有输出保护；源目录内输出拒绝；dirty源拒绝；非空供应商配置保留失败现场、不输出ZIP。材料全为明确标注的合成归档，Git为严格命令替身；不执行Git子进程、供应商二进制、安装或联网。成功用例使用真实bootstrap源码字节但不执行这些模块；不证明真实Git获取、供应商兼容或Windows行为。

总监批准后，lead在冻结隔离副本实际执行一次 `python3 -B -m unittest discover -s tests -p 'test_online_package*.py' -v`（cwd=workbench）：19通过、0失败、0跳过，退出0；包含旧helper13项和新增完整caller6项。源码执行前后身份一致，未扩大范围或重跑。精确命令、源码身份和日志见 `evidence/p2-online-build-13/results.json`。本次为lead执行证据，新增测试尚未独立复审；生产代码和旧ZIP未改变，不继承为Windows验收通过。本批新增测试/文档/证据尚未提交推送。

## P2-09-ONLINE-INSTALL-12：候选ZIP已制成并核验，Windows执行仍待

当前交付：源码已固定为 `837caf5709f62ddfadd904532cbc01443cb0dfb4`，获批builder执行退出0。`Hermes-Portable-Online-Test-837caf5709f6.zip` 为172289446字节，SHA256 `52cecef1e3bb83d19b6445925f5e9b57ebb4d0038b8ada69daa3038e6877dca5`。独立CRC、路径/类型/大小写、精确清单、解包后6192载荷文件大小与哈希、bootstrap源码/静态导入闭包、批处理CRLF、私人文件策略与供应商原字节投影检查全部通过；ZIP共6193文件含manifest。实际调用完整build并确认省略记录及原归档不变，关闭上一轮完整builder输出证据缺口。证据见 `evidence/p2-online-install-12/package/`。

本段覆盖以下历史“未提交/未制包”记录。包已保存在本机持久交付目录，包内是固定源码说明快照；外围交付状态保留Windows未验门禁。不是离线包，不是正式发布，不把静态闭包或解包通过说成Windows可运行。公司查重未送达；Windows原生监督器、真实uv/npm安装构建及CLI/Dashboard交互尚无本批执行证据，实际安装门禁未解除，release_ready=false。正式集成和真实实例未改。

当前状态覆盖：总监批准后，lead在冻结修正版独立副本完成Node50/50、Python13/13及语法检查，均退出0；旧executor对应新增参数断言如期退出1，证明能检出缺少-B，非Windows缓存实机复现。源码执行前后身份一致，四文件独立静态审查已通过。精确命令、源码及原始/脱敏日志哈希见 `evidence/p2-online-install-12/final-fix/results.json`。未联网安装、未执行Windows二进制或模型。以下为历史发现及修正过程；最终ZIP与Windows验收尚未完成，下一项为同一批准批次内的固定提交制包/解包。

2026-10-25 最终冻结快照的独立只读复审 `deleg_fe09b53d` 确认父目录别名修正及 bootstrap 导入闭包，但发现锁定 Node 官方归档含空 `node_modules/npm/.npmrc`，会触发现有私人配置拒绝，导致安装停在 source 阶段。lead 已亲自只读核对该归档成员为0字节；这是确定材料/代码冲突，不是已运行 Windows 故障复现。另确认 supervisor 用 `-I` 而无 `-B`，正常可写包内可能生成未列入清单的 Python 缓存，影响包重复使用。

本轮仅修 builder 的材料投影（只省略锁定归档提取副本中这个精确路径的空普通文件，非空/链接/缺失拒绝，清单记录省略身份，原归档不变）及 executor 两层 Python 的显式 `-B`；不放宽协调器/组装器的私人配置禁入规则。补充对应 Python 边界用例及生产 spawn 参数断言。四文件修正已由 `deleg_26c38b26` 独立只读复审：生产增量静态通过、未发现确定新增阻塞；lead已核对四文件当前字节与冻结身份一致。回归尚未执行，历史50/10不覆盖此修正；旧证据保留，不覆写。Python新增回归仅覆盖真实helper，完整build调用顺序及manifest输出仍须最终制包/解包检查；JS只断言真实executor生成参数，不作为Windows执行后无缓存证据。新增验证批次见 HANDOFF，待总监批准。最终ZIP尚未构建，不能宣称可安装交付。

公司本次查重投递后台退出1、HTTP502，另提示本机 Hermes source update 未完成；没有送达/Windows验证证据，不自动重发或执行 Hermes 更新。与本机修正独立，不作为停止本机开发的理由。

用户选择全新独立 Windows 测试目录／空 U 盘、首次联网安装，并明确允许在专用隔离目录下载固定公开源码和依赖、安装依赖及构建；不覆盖旧实例、不读取私人配置、不调用模型。新增 lead 验证批次仍先报总监批准。目标是带初始化入口的实际测试包，不是将增量工作台 ZIP 冒充空盘安装。

基线仍为 `c1b19f5dbf05de4c8ac08690021e6c8c094d86ee`，保留已验证但未提交的 ENTRY-11 WIP。新增 `install-online-experiment.mjs`、`build-online-package.py`、`material-path.mjs` 及 Node/Python 回归，补充实验组装的路径契约和启动器存在断言。构建器拟从干净固定提交和已校验官方归档打包 Python/Node/uv/ripgrep、PortableGit SFX 及监督器；Windows 入口经用户明确确认后，在新的材料目录中监督解压 Git、获取精确项目/内核提交，再调用已有新根组装器。依赖安装与两套前端构建仍在 Windows 新根进行，包不是离线成品，不自动启动 Hermes。

材料实际进展：五份 runtime 归档已下载到 profile 专用 scratch，逐份 SHA-256 和字节数与仓库清单一致；Python、Node、uv 的发布方校验材料已读取且包含对应锁定哈希。这是下载身份核对，不是二进制可运行性验收。只读归档检查确认固定 Python 中有三条带空格／括号的 setuptools 资源，原组装路径语法会拒绝；新增路径 helper 允许这些普通相对文件名，同时拒绝 Windows 设备别名、穿越、反斜杠、ADS 和尾部点／空格。

本机子 Agent `deleg_adc47f2a` 已回交八文件独立静态审查，指出隐式父目录大小写别名未拒绝；lead 已修正逐级名称/类型登记并补回归。总监批准集中验证后，在旧 builder 上运行新增用例实际退出1（ValueError未抛出）；修正版三条 Node 语法检查均退出0，六文件 Node 回归50/50、Python归档回归10/10通过，源码执行前后身份一致，无网络安装或Windows二进制执行。原始及脱敏日志、源码身份见 `evidence/p2-online-install-12/results.json`。修正后两文件增量尚未独立复审，当前未生成 ZIP、未提交推送本批、未进行 Windows 安装。旧 ENTRY-11 的105项不覆盖这条新安装链。保持 `release_ready:false`，保留 Windows Job/交互与依赖兼容门禁；不得称当前已交付可安装测试版。

## P2-09-ENTRY-11：入口失败诊断与恢复引导，获批集中验证通过

2026-10-23 用户要求继续完成阶段性任务、最后一起测试。本批以已交付 `c1b19f5dbf05de4c8ac08690021e6c8c094d86ee` 为基线，lead 继续补齐原生入口的失败可理解性，不启动新的模型配置或 TUI/Desktop 实现。下方 ENTRY-10 的通过结果只属于其固定版本，不能继承给本批修改。

实现范围：原生操作 HTTP 409 在精确白名单匹配时附加 `X-Native-Entry-Reason`，保持已有状态码、JSON 错误体、认证/Origin、互斥及状态响应契约不变。客户端只接受白名单头，不读取错误正文；403/404/普通409/传输或取消分别映射本地固定诊断。hook 经既有身份代次栅栏传至 SettingsPage/NativeEntryPanel，以中文说明版本不兼容、资产缺失、锁占用、页面未就绪和停止未确认等情况。未知错误不输出原文；任何诊断都不证明 idle 或安全退出，不自动刷新、重试、重启、清锁、安装或回退。缺失的固定资产路径统一转为 `NATIVE_ASSET_INVALID`；其他文件系统错误不推定原因。idle 下的停止和被禁用的刷新 handler 增加实际拦截。

已编写并纳入本次集中执行的回归：HTTP 头投影和错误体兼容；错误正文不读/取消；精确匹配与伪装代码拒绝；诊断不放宽启动门禁；刷新/身份切换清除旧诊断；面板安全文案及 idle 停止；资产缺失/类型错误；浏览器打开失败后的显式刷新和准备拒绝提示。浏览器方法升为 v2，旧 v1 通过记录保留，本次 v2 结果以新日志为准，不继承旧版结论。

2026-10-24 独立静态审查 `deleg_8a02bfd6` 回交：限定12文件及直接调用链未发现可证实阻塞；两端16项白名单一致，身份与请求栅栏、错误正文隔离、旧接口兼容无新增源码阻塞发现。lead 已对照审查哈希与保存的原始快照核实身份。针对覆盖建议只补三个测试文件，未改已审生产源码：新身份请求保持 pending 时结算旧成功/失败、手动时钟触发超时分类、禁用刷新 handler、全白名单源码一致性、合并原因头及成功响应头、仍显示诊断时撤销身份。补测增量未被上述静态审查覆盖，已纳入随后总监批准的集中执行。

总监批准后，lead 于2026-10-24 在独立 base+overlay 源码树实际执行 HANDOFF 四条命令各一次：Node定向105通过、0失败/取消/跳过；validate18组件；tsc/Vite新构建；浏览器methodVersion=2的10项通过，cleaned=true、hermesModelExecuted=false，四条退出码均0。执行前后源码身份一致，复用manifest/lockfile一致的现有依赖，没有安装。源码哈希、精确命令、退出码、构建资产哈希及脱敏日志见 `evidence/p2-entry-diagnostics-11/results.json`。本批保持未提交，不将旧HEAD说成已含本批实现；未执行全量npm test或独立语法检查命令，也未把编辑期语言服务诊断当测试。

此结果关闭本批Linux集中验证门，不等于P2阶段整体完成。ENOTDIR竞态/其他文件系统错误注入、浏览器旧错误迟到仍非本批直接执行证据；旧响应隔离新增用例是 hook 合成调度。当前只覆盖同步操作拒绝及请求错误的诊断，异步 ready 拒绝仍按原契约呈现 unknown，不编造其历史故障原因。Windows 真实 Dashboard/CLI、运行时材料和安装门禁仍保留；正式集成、真实实例及release_ready未变。

## P2-09-DASHBOARD-ENTRY-10：优先推进 Dashboard，页面就绪接线已验证

2026-10-22 用户要求先继续 Dashboard 入口，暂不等待公司网关修复。lead 基于 `66a6ebbb62f36e0cadca0b7001b93a736819e6c3` 亲自补齐生产 adapter 的启动就绪及打开前检查：保留认证 RPC，再检查同进程 token 的 Dashboard 首页/bootstrap/root、预构建 module 与 stylesheet 资源；新 `native-dashboard-health.mjs` 已加入生产打包白名单。固定上游 `28044757aabd34010bd9f5f3e3f82b0906b46241` 的 web_server.py 与 web/index.html 已通过本地 Git 对象只读核对，不修改上游/默认 P0/依赖/共享锁。

检查只向该 owned 端口的 127.0.0.1 发 GET，不发送凭据请求头/URL，不跟随重定向，不访问页面声明的外域、编码或穿越路径。首页最多 2 MiB，最多 16 个入口资源，单资源 16 MiB、资源累计 32 MiB；默认 5 秒截止覆盖首页、资源头与正文。资源 GET 与固定上游 CSS 路由一致，不能假定 HEAD 可用。缺页、headless 页面、身份不匹配、HTML fallback、空 JS、超限、响应停滞和取消均不允许按页面就绪继续。停止后旧检查迟到成功也不能打开浏览器。这只证明入口 HTTP 内容可获取，不执行或证明整套 Dashboard JS、动态 chunk、插件或真实交互可用。

实际先红后绿：旧 adapter 的新增缺页用例退出 1；开发中 GET-only 夹具暴露 HEAD 假设后修正，历史日志单列。最终五文件 overlay 在独立源码副本两份语法检查、九文件 Node **64/64**、validate **18 组件**、build 全部退出 0；构建后 native-entry-browser-check **7 项通过**、cleaned=true、hermesModelExecuted=false。HTTP 用例实际调用生产 adapter+页面检查器，但 RPC/进程/浏览器打开为替身；浏览器脚本使用合成 native adapter，不冒充原生 Dashboard 运行。精确命令、源码/上游身份及脱敏日志在 `evidence/p2-dashboard-entry-10/results.json`。

2026-10-23 本机独立纠错复审已回交：撤回此前测试文件第21行语法阻塞，原始字节不含所报截断表达式，属于工具显示脱敏/截断误判；五文件与暂存区、上述 manifest 及实测副本一致，未为此改写正确源码。在五文件及所读直接调用链范围内未发现可证实的剩余阻塞。该复审仅静态检查和身份核对，没有重跑测试，不是公司 reviewer 的动态审批。页面的5秒截止不包含先行 RPC 的独立超时。

本批可作为已完成本机隔离验证和独立静态审查的开发检查点交付，不能视为实机可用或发布批准。Windows 原生进程与真实 Dashboard 实例、完整资产构建/安装及实机交互仍待，正式集成与 release_ready 不变。既有执行器独立审查和通信失败记录保留于下节，不要求用户重复测试本机合成用例。

## P2-09-EXPERIMENT-EXECUTOR-09：lead 接管执行器，Linux 隔离验证通过

2026-10-21，总监要求 lead 接管代码开发并授权本轮操作。基线 `846d34a226fbbd6fcd7e031a1b0924f7733ace5f`；原有 CLI-only 验证文档 WIP 已单独备份保留。lead 亲自新增 `experiment-command.mjs` / `experiment-command-worker.py`，将实验准备的 Git、版本查询、uv/npm 全部改为串行 await 的监督执行；复用未修改的 `native-entry-host.py` 创建时 Job 归属、整树退出和排空证明。worker 只写有界私有 stdout/退出码收据，不转发 stderr；Node 必须同时取得有效 closed 帧及 host close 才能读取结果、清理该命令目录或推进下一步。超时先发送 EOF，宽限期仍无证明则仅终止自有 host、报未知并保留目录，绝不以 kill 返回值证明整树已退。

新增回归先暴露异步接线缺口（两项在源码身份阶段失败，不能称进程树缺陷复现）；另实际复现 ready.flag 发布碰撞后收据仍误写 prepared 的问题，已修正为恢复阻塞标记并更正失败收据。组装失败日志新增 `commandTreeExited` 三态字段（true/false/null），不把普通验证错误伪装成退出证明。默认 P0、原生 host、正式集成、依赖及 release_ready 均未修改。

实测对象为上述 base 加 `evidence/p2-experiment-executor-09/results.json` 中六文件 overlay 哈希，执行目录为自有 scratch 的独立源码副本。两份 Node 语法检查退出 0；六文件 Node 定向 **39/39**，退出 0；Python worker **4 通过、3 Windows 项跳过**，退出 0；既有 native host **3 通过、2 Windows 项跳过**，退出 0；`npm run validate` 18 组件、`npm run build` 均退出 0。仅复用已存在且 manifest/lockfile 一致的依赖，无安装。完整命令、退出码及日志哈希在上述 results.json，原始失败与最终通过日志分开保存；发布日志只替换本机绝对路径，不改断言或退出码。未执行全量 npm test、浏览器或真实 Windows/安装/模型/实例。

本批只关闭 Linux 合成与构建验证，不声称 Windows 安装进程树已实测。本机独立只读子 Agent 已返回六文件及 native host/protocol/Job 直接调用的静态审查：未发现可由源码证实的阻塞缺陷；没有执行测试，此结论不是公司 reviewer 的 Windows 审批。lead 已核对六文件与实测 overlay、提交 `66a6ebbb62f36e0cadca0b7001b93a736819e6c3` 的 blob 哈希一致。该提交已推送并远端回读，后续接手工作区干净。

公司投递已确认阻塞：早先接管通知返回 HTTP 502；固定版本复验任务返回 HTTP 401 `Invalid gateway API key (API_SERVER_KEY)`，不能视为任务已送达或 Windows 验证已启动。旧连接消息另报等待回复超时，可能在连接恢复后送达，不盲目重发。下一门禁为恢复公司受认证通信（凭据只在对应机器本地处理，不在聊天传递），或由用户人工转交 HANDOFF 顶部固定版本任务；取得 Windows worker+host 原生证据及受控材料后才形成真实 CLI 实验执行批次。真实 apply 仍冻结，不把宽泛授权当成已满足材料、兼容与恢复前提。

## CLI-only 固定版本：lead 获批隔离验证通过，真实执行仍冻结

总监批准三条命令后，lead 从干净 `846d34a226fbbd6fcd7e031a1b0924f7733ace5f` 导出独立源码副本，在本 Profile scratch 中实际执行各一次：`node --check scripts/prepare-native-experiment.mjs`、`node --check tests/native-experiment.test.mjs`、`node --test tests/native-experiment.test.mjs tests/package.test.mjs tests/portable-layout.test.mjs`，三条退出码均为 0；定向测试 15 通过，0 失败/取消/跳过/todo。CLI-only 跳过上游 web workspace、保留工作台准备及非法 scope 拒绝的合成断言通过；被记录的四份源码文件执行前后哈希一致。

证据目录：`/home/zgj/.hermes/profiles/usb-project-lead/cache/scratch/cli-only-verification-b_ibfi_5/`，含固定源码归档、三份原日志及 `results.json`；测试日志 `03.log` SHA-256 为 `633691782700bbc1f9c4b50681eb079b1355be1ba2de25090395d3a3c73357c9`。这是本机证据路径，不是公司侧已收到的附件。未重跑、未执行真实 Git/uv/npm/Python 安装命令，未联网、安装、构建真实资产、启动 Hermes 或触碰真实实例；新脚本中的子命令全部使用计数替身。

本条覆盖下方“最新两项测试尚未执行”的历史状态，仅关闭此固定版本的 lead 隔离验证门。尚不代表 reviewer 对本版独立复验或实机验收通过；材料来源、安装进程树异常收尾、Windows 依赖与 CLI 键盘交互仍未关闭。真实 apply、正式集成和发布继续冻结，release_ready 不变。

## CLI 优先里程碑：不再等待原生 Dashboard 构建

用户追问何时能打开 CLI，当前验收目标收窄为工作台点击原生 CLI → 新控制台出现 → 键盘输入可用 → 正常退出并确认锁释放；不是浏览器内嵌终端，也不以 synthetic started 代替交互通过。尚无足够依据承诺完成日期，不能将上一批 13/13 当实机完成。

lead 已只读确认 native-entry-host.py 的 cli 分支使用 CREATE_NEW_CONSOLE，不走非 cli 的 DEVNULL 分支；这消除了“CLI 是否直接被 DEVNULL 接管”的源码疑点，不证明 Windows 键盘实际可用。本轮新增实验准备 entryScope=cli 模式：保留工作台构建与所有版本/锁/新目标门禁，只跳过上游 Dashboard workspace 安装和构建，收据明确 cli 范围。默认 cli-and-dashboard 行为不变。新增两项合成测试，尚未执行，不继承旧源码通过结果。

仍阻塞真实执行：材料来源、固定环境是否已存在、安装进程树异常收尾。reviewer 下一步仅在已授权公司项目仓库及既有专用隔离测试目录核对可复用材料的路径/固定 Git 身份/文件存在性，不扫用户目录、不读凭据、不执行 Python/npm/安装器、不读真实 E 盘；只报可用/缺失/未知，不启动实机。lead 新源码的原三条隔离命令需总监重新批准，每条一次；不得借 reviewer 复验绕过 lead 门禁。

## NATIVE-EXPERIMENT-08：lead 批准范围内隔离验证通过，实机仍冻结

从 63a9900 开始新增实验准备 CLI 与配套合成测试，不再仅停留在部署文档。实现本地明确批准材料的身份核对、新目标独占创建、固定 28044757 源码/新 venv、工作台与 Dashboard 两套构建、实验 manifest/收据和末尾 readiness 接线；不触及默认 P0 或真实 E 盘。完整输入契约及命令范围见 HANDOFF 顶部。

总监批准后，lead 在干净固定源码 `3bf5b8e0be302316ac545b27b3c08091415f69fc`、cwd=workbench 执行三条命令各一次：`node --check scripts/prepare-native-experiment.mjs`（退出 0）、`node --check tests/native-experiment.test.mjs`（退出 0）、`node --test tests/native-experiment.test.mjs tests/package.test.mjs tests/portable-layout.test.mjs`（退出 0，13 tests/pass，0 fail/cancelled/skipped/todo）。使用本 profile scratch；新测试的 Git/uv/npm/Python 全为计数替身，没有安装、联网或真实构建/启动。测试日志原字节 SHA-256 为 `0f084d61181f0e6a3ee8e279bc5199cb1c39ac91817a5b8fc585e9aa70687890`；两份语法检查日志为空，退出码单独记录。原日志与 results.json 保存于 lead scratch 的 `native-experiment-08-evidence-ea_q5dry/`，这只是本机证据位置，不是跨机附件。

reviewer 已报告固定 3bf5b8e 的只读审阅无阻塞发现；未声称 reviewer 独立执行该测试。当前仅语法与合成隔离验证通过，真实 apply 仍禁止，安装进程树超时确认、材料来源、Windows 依赖兼容性和入口实机验收尚未关闭。该入口需要本地已审 runtime 材料，不是从空介质自动下载一切的完整发行包；release_ready 不变。本次无源码修复、无重跑、无扩大执行范围。

## 实机准备材料接收，部署链仍阻塞（lead 接管）

已审公司准备材料 `ddd039db70bcb59f28d619d8336180268ed0b226` 并接收到开发工作区，T4 明确冻结，不视为可执行审批单。默认 setup 的 29112bef 与 P2 原生入口 28044757 确定不匹配；无版本偷换或放宽 adapter 门禁。

lead 本轮只读核对固定上游完整 Git tree 和构建清单，确认 Python 要求 >=3.11,<3.14、Dashboard 使用根 npm workspace/lock 并依赖 apps/shared，产物为 hermes_cli/web_dist；另核对 setup 必填 -Root、P2 打包需 REPO/OUT 两参数。详细裁决已写入 ACCEPTANCE 的准备章节顶部。未安装、构建、测试或运行 Hermes。

设计选择：首个候选面向全新独立 Windows 实验根，保留已审 28044757；不更新现存 E 盘、不改默认 P0 清单。尚缺配套独立 venv/runtime/两类资产的实验准备入口及验证关系，归 lead 亲自负责；在实现与隔离验证前不提交实机执行申请。employee 暂停，reviewer 可只读审阅本裁决，不运行旧 T4。准备方案不等于完整部署功能已实现。

## GUARD-CALLERS-06 收口并开发整合；转实机验收准备

公司固定结果 `04ac238472c9697c8229b0f977b80c9e76b2f6a6` 已独立复验四文件命令 25/25、退出 0；lead 已静态核对未退出/未排空及 error 收尾用例，并核验归档 `9b52036a3878be354c83b57e4f342d58e2e87350` 中 R2 日志 SHA-256 `502841d8b38b4c5fa5b9915d8b6c0119889122180ea44996c1f1f115f3ce9ce6`。这是 reviewer 执行证据，非 lead 自测。

已合入 dev/lead，开发合并提交 `fd2e0ea571d724d8ddc8060e073745220141fe51`，incoming 仅 ACCEPTANCE 与新测试文件，workbench 整树与公司结果无差异；未执行合并后测试，不将历史结果写成新执行。正式集成仍不放行。

下一批 `P2-09-REAL-ACCEPTANCE-PREP-07`：employee 编制固定版本/资产矩阵、两类部署前提、真实入口验收与备份回退清单，reviewer 独立只读核验，lead 裁决核心缺口后报总监。仅改 ACCEPTANCE，不部署、不运行真实入口、不安装、不花模型费用；本批目标为完整可审批方案，不冒充实机验收。详见 HANDOFF 顶部。

## 下一集中批次：legacy / managed guard caller 补证

lead 已获取证据归档 `1a455d2d3a56e17065dd4dc51994e8e0799774c7`，核对相对上一归档仅 README 改变，八份日志保持原字节；日志接收任务结束，不再派元数据返工。本轮实际读取 startHermesInstance、portableWindowsOptions、legacy 及现有 lifecycle 测试：managed 已有安装标记注入回归，但不等于实际 checkEntryGuard 的 restore/协调文件时序；legacy 现有 runLockedLegacyEntry 合成 prepare 不等于 launchLegacy 的真实 guard 接线。

据此下发一个包含两 caller 和验收映射的 `P2-09-GUARD-CALLERS-06`，employee 从已组合且验证过的源码后继文档基线 ad0f8df 受控快进，只补新测试及 ACCEPTANCE，reviewer 独立验证。managed 测实际 startHermesInstance 加真实 guard，legacy 在 Windows 临时合成根测实际 launchLegacy；不修改生产、不启动 Python/Hermes、不接触 E 盘。详细注入位置、可观察断言、单条命令和暂停范围见 HANDOFF 顶部。

这批只补两类 caller 的拒绝路径，不把合成 fixture 当真实便携部署，也不把 helper 接线替代 CLI/Dashboard 成功使用。正式集成及 E 盘部署保持未放行；下一真实环境批次仍需完整匹配 P0/P2、固定内核、依赖/资产、备份恢复和数据保留方案。本轮 lead 只有源码审阅、文档与派单，没有执行测试。

## 组合及 WIN 证据已通过 Git 收取

用户指出日志可直接经 GitHub 交付。lead 已实际 fetch 并读取证据提交 `432bcfe8cf590de3c9d362a16ea376699199b54a` 的 `evidence/p2-dev-combine-04/` 九文件；8 日志完整可读，不再等待聊天长消息。7 份日志 blob 哈希与索引原样一致，Python 日志发布 LF 哈希为 `68192080f24fd7b1365d9425fadd3c0044f8601a18e373aa7e6c151e200e7566`，转 CRLF 后与索引所报原日志哈希一致；此差异已定位，索引待标明两者，不重跑。

接收 reviewer 对组合源码 `6a0daaaf0576c594ec58f652be027e5d5a6394e5` 的 75 项定向、18 组件 validate、build、浏览器 7/12/19 项及退出 0 证据；接收历史 WIN 固定 aa4c636 的 Python 5 项（3 契约、2 Windows 原生场景）和 Node 25 项日志。以上是公司执行证据及 lead 对已发布材料的核对，非 lead 重跑或对公司机器直接取证；已知 windows-job-host.py 执行前磁盘哈希缺失继续保留，不补造。

源码组合验收按上述隔离范围通过，正式集成仍未放行。真实 CLI/Dashboard、启动器与数据保留、legacy/managed 另两条 guard 时序仍待。下一步不再重复收集长聊天日志；reviewer 只补归档 README 元数据，具体见 HANDOFF 顶部，employee 保持暂停。已有证据归档不作为新增源码开发分支，三分支源码协作规则不变，本轮不部署 E 盘。

## GUARD-ORDER-03 收口并合入开发组合检查点（待组合复验）

公司最终 result `64d32cc7229800d5f4a37e8de338d452068f862e` 已由 lead 实际获取并静态审阅。R1/R2 修正测试驱动异常清理，guard.keep 已接线、READY 前后超时统一等待、退出与排空分别记录，事件夹具实际调用注册 cleanup 并断言哨兵保留。reviewer 报告独立定向 15/15、退出 0，原始 23 行日志已在群内接收；日志属于公司执行证据，聊天转录不宣称原文件 SHA-256 已核验。GUARD-ORDER-03 按 portable native 组装路径范围收口，legacy/managed 另两路径、真实原生使用仍待。

用户要求继续推进，lead 在干净 dev/lead 上以 `122c6124954e7ca2a3799328cba6e83021e2b5cc` 为第一父、公司上述 result 为第二父完成无冲突开发合并，源码结果 `6a0daaaf0576c594ec58f652be027e5d5a6394e5`。五个 incoming 文件（ACCEPTANCE、客户端/面板测试、package/guard 新测试）均逐字节核对为公司已审文件；lead 的三文件浏览器修复保持原提交字节，生产、启动器、依赖、发布资格没有改变。保留双侧历史，不强推、不改公司分支或正式集成分支。

本轮未运行 lead 测试，组合树尚未验证，不继承各分支通过数。下发 `P2-09-DEV-COMBINE-04` 给 reviewer，独立固定 worktree 做定向组合、validate/build 与已有合成浏览器回归，命令和一次执行上限见 HANDOFF 顶部。employee 保持暂停。WIN-NATIVE-VERIFY-02 仍为报告通过、完整证据待接收，本批不重跑 Python/真实 Windows 原生用例，不替代 CLI/Dashboard/U盘门禁。

## WIN 证据补交与独立 guard 时序覆盖并行推进

WIN-NATIVE-VERIFY-02 目前仅接收到 reviewer 的通过摘要及局部补交，长消息两次从中间截断，完整命令/退出码/日志尚未齐备，继续记“报告通过、证据接收未齐”。缺失的 windows-job-host.py 执行前磁盘哈希不能由事后 Git 内容哈希补作执行证据；employee 对 CRLF/blob 的只读旁证只证明源码可追溯。停止重复长报告和重跑，reviewer 只整理现有脱敏附件及短摘要；不因此要求用户测试或修改 E 盘。

已读实际 portable-native-entries 测试：现有成功路径在 adapter.prepare 内争锁，拒绝路径在启动前篡改 launcher；两者尚不是 guard 读取时持锁及持锁窗口新增异常的直接动态证据。因此将独立测试工作包 `P2-09-GUARD-ORDER-03` 下发 employee，限定两文件和真实 portable native 组装路径，接口/生产代码不改；reviewer 组织固定版本复验，细节见 HANDOFF 顶部。lead 实际回读公司固定 base `2ffcb087027a060e14fa746ee28d5fd2f28cc1df`，核对生产 scripts 与已审 aa4c636 无差异；本轮没有测试执行、分支合并或部署。

该覆盖工作不依赖 WIN 批次通过，可以隔离推进；不关闭 legacy/managed 另两条 guard 时序门禁、原生 CLI/Dashboard 与真实 U 盘验收。employee 暂停仅对本工作包解除，reviewer 仍不得并发写其工作区。

## 浏览器修复接收；转入隔离 Windows 原生监督验证

reviewer 重新按授权在固定 `aa4c6360b800e247fb95f971a23cea237fce1b6b` 的独立 detached worktree 回交：Windows 定向 17/17、validate 18 组件、build、浏览器 7/12/19 项，六条命令各一次、各退出 0，浏览器均 cleaned=true、无模型。lead 只读计算 Git blob 的 SHA-256，并将 LF 转为 CRLF 后核对，三个结果与 reviewer 报告的完整 Windows 文件哈希全部一致；这是换行格式差异，不是代码漂移。接收三文件静态批准和本轮 reviewer 固定版本动态结论，明确为公司执行证据，非 lead Windows 自测。Linux socket 子断言在 Windows 未运行，lead 前次 Linux 证据另列；先前错对象/混合快照结果不恢复为有效验收。

本轮报告的命令日志仍使用缩略哈希，要求 reviewer 保留并补交现有完整日志及完整哈希，不因此再跑一轮。其报告的远端实际执行、清理及 dist 清单未由 lead 在公司机器独立读取，不能将源码哈希核对写成对远端运行的直接验证。

下一批 `P2-09-WIN-NATIVE-VERIFY-02` 由 reviewer 执行：同一固定源码独立 worktree，新 native host Python 的 3 个契约和 2 个 Windows 原生用例，以及 6 文件 Node 锁/协议定向命令；每条一次，具体命令、清理和暂停范围见 HANDOFF 顶部。lead 本轮仅源码读取、哈希核对与派单，不运行新增测试；employee 保持暂停。该批无需 E 盘、安装或真实 Hermes，仅自有合成进程/临时锁；不扩展为旧 host 全量测试或真实 CLI 交互。

正式集成仍不推进，公司分支尚未合入。E 盘版本/资产缺口仅为 reviewer 报告，未获 lead 实机核验；不得据此直接安装 P2 或切换内核。真实部署必须同时核对匹配 P0 启动器、版本/依赖、数据保留与恢复方案。原生 CLI/Dashboard 实际使用及 U 盘门禁继续保留。

## 浏览器修复固定交付与独立复验派单

用户要求继续推进，lead 按既有 dev/lead 源码发布授权保存三文件修复为 `aa4c6360b800e247fb95f971a23cea237fce1b6b`（base `6cfa496c5bc924574054d4f7e66a24bd9647b81a`），提交 blob 与下节实测快照一致。此前“未提交”描述保留为验证时状态，当前已提交；远端发布是否成功以本轮回读为准。原有进度 WIP 保留并随本次任务文档保存，没有新增 lead 测试、公司分支合并、正式集成或实例更新。

下发 `P2-09-BROWSER-FIX-REVIEW-01`：reviewer 审查固定三文件、按已有批准范围在独立环境有界复验，并只读准备 Windows 集中验收方案；详细命令和暂停边界见 HANDOFF 顶部。employee 保持暂停。本次修复未获独立批准，不能继承旧核心静态结论；Windows 原生门禁和 guard 持锁时序动态待验仍未关闭。

## NATIVE-01 浏览器有界批次：准备阻塞已解除，合成页面回归通过

总监在群内明确批准本批。lead 在 `6cfa496c5bc924574054d4f7e66a24bd9647b81a` 的独立源码副本执行一次 Chrome/CDP 诊断：沿用 native 浏览器夹具的嵌套临时目录可复现 `CDP_CLOSED`、Chrome `SIGABRT`，受控 stderr 明确报告 `Socket path too long`（SingletonSocket）。诊断退出 1，清理成功；这是已复现的夹具路径问题，不是页面或 Hermes 生产故障，也不据此追认此前另两个脚本失败的全部原因。

修复仅涉及三个测试文件：`workbench/tests/native-entry-browser-check.mjs`、`s1-browser-driver.mjs`、`s1-browser-driver.test.mjs`（后两者同在 workbench/tests）。新增短临时根 helper，将 native 浏览器 TMPDIR 放在配置 scratch 根直属的独立目录并纳入清理；不改生产实现、不改 sandbox、不回退到系统 /tmp。定向回归新增真实 Linux Unix socket 绑定断言及 native 调用点/清理接线检查。其他两个浏览器脚本本来使用短临时根，没有修改；本批进程 TMPDIR 固定为本 Profile scratch 根，避免再套多层证据目录。

测试代码身份为上述 HEAD 加三文件修改，测试源码清单 SHA-256：`0bf00153e474c8b662896fbedac5fc21f220f02f91dd110477ed9cb6aef0226d`。本地证据位于 Profile scratch 下 `browser-batch-wuk8gna9`，含 diagnostic.json、tested-manifest.json、逐命令日志及 results.json；不是跨机交付地址。实际 cwd 为该批 `source/workbench`，仅复用已有依赖。以下每条执行一次，没有失败重跑：

| 命令 | 实际结果 | 退出码 |
|---|---|---|
| `node --test tests/s1-browser-driver.test.mjs` | 17 通过，0 失败/跳过 | 0 |
| `npm run validate` | 18 组件通过 | 0 |
| `npm run build` | TypeScript/Vite 新构建通过 | 0 |
| `node tests/native-entry-browser-check.mjs` | 7 项通过；合成 starts/stops/opens 各 1，managedStarts=0 | 0 |
| `node tests/entry-control-browser-check.mjs` | 12 项通过 | 0 |
| `node tests/s1-browser-check.mjs` | 19 项通过 | 0 |

三个浏览器报告均 cleaned=true、hermesModelExecuted=false；scratch 前后目录差异仅新增 node-compile-cache，保留缓存，不称整个 scratch 清空。测试期间隔离源码哈希不变，三文件修复与主工作区逐字节一致，原有进度 WIP 在追加本记录前完整保留。没有全量 npm test、Windows/Python 原生测试、真实模型、安装、实例更新、正式集成或发布；HEAD 本身尚不包含修复，本轮未提交推送。该修复仍需独立审查，不继承 reviewer 对旧源码的静态批准。

公司证据另行接收：reviewer 回报 `2ffcb087027a060e14fa746ee28d5fd2f28cc1df` 的 PACKAGE-03-R1 原三文件 Node 命令 19/19、退出 0，并回报 `41387cdbbea4250482db97d094cd4b2602c8ebef` 全 44 差异文件静态审查完成；均非 lead 重跑。原“待组长回交”状态由此更新，guard 持锁时序动态确认仍待。正式集成仍要求 CLI 与原生 Dashboard 实际可打开且正常使用；本批真实浏览器加合成适配器不替代 Windows 交互、进程树与 U 盘验收。

## PACKAGE-03-R1 接收：静态补证已落实，待组长固定版本复验

lead 本轮远端回读并实际 fetch 公司 result `2ffcb087027a060e14fa746ee28d5fd2f28cc1df`，读取相对 `d27fc80345c374711873c4e70b616b487cad47fa` 的完整返工差异、最终测试全文及生产 guard；相对工作包 base `9e5c0df9b920f40b79691bd2173a78c43e39d98a` 的文件范围仍仅原测试与 ACCEPTANCE。独立 LF/CRLF 落盘、安装/恢复标记分别及同时存在、无锁/已有锁保留断言和恢复指引均已补齐；本轮没有运行测试，不把交付文档中的 19 通过视为 lead 或 reviewer 实测。

结论：原静态返工要求已落实，等待 reviewer 对上述固定 result 按原三文件 Node 命令回交独立结论、退出码及清理证据；不再重复派员工实现同一补丁。dev/lead 仍为 `6cfa496c5bc924574054d4f7e66a24bd9647b81a`，未合并公司分支，原有进度 WIP 保留。浏览器准备失败另行申请有界诊断/重跑，Windows 原生与正式集成门禁不变。

## PACKAGE-03 固定交付只读审阅：需补证

lead 已实际获取公司 result `d27fc80345c374711873c4e70b616b487cad47fa`，读取相对 base `9e5c0df9b920f40b79691bd2173a78c43e39d98a` 的完整两文件差异，并核对生产 portable-entry-guard 与实例锁目录定义。本轮未执行测试、构建或浏览器；公司文档记载的 15 通过不作为 lead 自测，也尚缺本轮 reviewer 固定版本回交。

静态结论为覆盖/指引需返工，不是已证实生产 guard 缺陷：匹配组合用例未实际改写 LF/CRLF，却在矩阵声称等价已验证；安装与恢复标记同时存在，仅触发第一个拒绝，不能证明恢复标记单独生效；除 gateway 已有锁场景外，缺少成功及各拒绝路径不创建/不改写锁的断言。另，拒绝后的处理指引不能把“确认无运行实例”直接等价为可以删除恢复标记；需保留标记、先核查中断事务与恢复证据，具体真实恢复操作另获用户批准。

有界补证 `P2-09-NATIVE-PACKAGE-03-R1`：employee 仍为 dev/company 唯一写入者，仅修改原测试及 ACCEPTANCE 两文件；reviewer 组织返工并在 employee 暂停后独立运行原三文件 Node 命令，回交固定 base/result、命令退出码、失败/跳过、清理证据与结论。补独立 LF/CRLF、两个标记分别存在及同时存在、无锁保持无锁与既有锁原样保留断言；更正操作指引，不改生产、依赖或 guard 哈希。此为该交付第一轮返工；正式集成及浏览器、Windows 门禁不变。

## 当前版本门槛：CLI 与原生 Dashboard 可实际打开

### 源码提交与恢复公司协作

**最新接收与下一批**：lead 已实际 fetch `9e5c0df9b920f40b79691bd2173a78c43e39d98a` 并读取 `6743c58..9e5c0df` 两测试文件差异，R1 的用例状态隔离、failed/unknown 确认后允许停止、卸载状态写入断言和 idle 标题收窄均已落实。接受本批功能性补证，保留 reviewer 独立副本 27 项/validate/build 通过作为公司证据；lead 未重跑、尚未合入 dev/lead，未安装依赖。failed 用例一处“Open is visually available”注释与实际 disabled 实现不符，仅作非阻塞说明问题，不开启重复生产返工。

用户要求下发下一批，正式派 `P2-09-NATIVE-PACKAGE-03`：employee 在 dev/company 以 `9e5c0df` 完整 SHA 为基线，仅新增 `workbench/tests/native-package-contract.test.mjs` 并修改 `docs/p2/ACCEPTANCE.md`，验证真实白名单源码 staging、guard/P0 分包匹配与失败保留，再更新验收指引。详细目标/命令/边界见 HANDOFF 顶部。该批只需已有 Node 标准库，无 npm 安装、构建或浏览器；reviewer 实测后汇总。浏览器准备阶段诊断、Windows 原生门禁及 lead 核心修复不因此关闭；本轮仅源码读取与任务文档发布。

公司 `6743c58e5740271118865bf8af0b26bb767a9c5a` 已由 lead 实际 fetch，核对相对 `41387cdbbea4250482db97d094cd4b2602c8ebef` 仅改约定三文件。reviewer 回报定向 25 项、validate/build 通过属于公司执行证据，本机未重跑、尚未合入。源码静态复核发现补证需求：面板合成调度器使用全局 slots 且测试间未重置；failed 状态“只保留读取”说明与生产允许确认后显式 stop 的契约不一致；停止 idle 用例仅查 disabled 却以标题声称 never applies；卸载迟到 reject 用例仅检查调用数量，未断言无失败状态写入。结论是测试/说明需有界返工，不据此改动正确的 failed→显式 stop 生产机制。

`P2-09-NATIVE-COVERAGE-02-R1`：employee 继续仅修改原三文件，为每个交互用例创建独立调度器状态并清理全局注入；补 failed/unknown 经确认可 stop、不能 start/open，以及未确认不得 stop 的真实回调断言；idle 明确只断言禁用按钮，不夸大为任意程序调用均被拒绝；卸载迟到成功/失败补 setState 写入计数或等价可观测断言。reviewer 按原三条 Node/validate/build 验证范围独立复验并更正验收说明。第一轮返工，不增加生产文件、依赖、浏览器或真实实例操作；仍遵守最多三轮及生产缺陷立即上报门禁。lead 不编辑员工三文件、不运行新测试，等待固定 R1 结果后再决定整合。

用户要求推送源码并下发审核/开发任务。lead 已将此前完整 WIP 保存为开发检查点 `41387cdbbea4250482db97d094cd4b2602c8ebef`（base `d8f64a8fe831d4db277c221c9bcf47d87be2b882`）；44 个提交文件与审查归档字节一致，测试状态仍为下方 417 通过、Python 定向 3 通过/2 跳过、浏览器准备失败，不能当作通过正式验收。随后仅追加任务单提交；远端发布身份以本轮 push 后回读及群内回交为准。

详细工作包见 HANDOFF 顶部：reviewer 承接 `P2-09-NATIVE-01-STATIC-REVIEW`，在独立工作区只读审查固定 base..result；employee 承接 `P2-09-NATIVE-COVERAGE-02`，仅补客户端/面板测试和 ACCEPTANCE 指引，不重复页面开发，不改生产核心。公司 dev/company 已核实为 source result 的祖先，可本机重核后受控快进；lead 不同时编辑员工三文件。日常 employee → reviewer → lead，组长复验必须实际执行任务单内命令；未获取源码不能称已审阅，未执行不能报通过。

本轮不执行新增 lead 测试或浏览器诊断/重跑，不将推送授权扩展为前述待批准诊断。正式集成、Windows/实机验收、独立通过与 release_ready 门禁均不改变。

历史接管记录：工作包 **P2-09-NATIVE-01**（总任务 P2-09）由 lead 负责核心生命周期、固定版本适配和管理 API。用户确认接续未提交修改，随后批准验证。接管基线为 `d8f64a8fe831d4db277c221c9bcf47d87be2b882`；原 6 个修改文件及 2 个新增文件已保存完整副本和 SHA-256 清单。后续提交与协作状态以上节为准，下方“未提交/尚未测试”等仅表示各历史批次当时的状态。

### NATIVE-01 收尾验证：浏览器准备阶段阻塞

用户批准收尾验证后，lead 实际执行了申报的完整批次，没有修复重跑。基线仍为 `d8f64a8fe831d4db277c221c9bcf47d87be2b882` 加未提交修改；固定源码清单 SHA-256 为 `1ab7ab23024e4ed9698283af6c4fcbbb0d4882119ec9c2ab6791eea524342f4b`，隔离证据目录为本 Profile scratch 下 `native-01-verification-cfbofifx`。验证期间主工作区源码哈希未变化；随后仅更新本进度记录。

| 实际命令 | 结果 | 退出码 |
|---|---|---|
| `npm test` | 417 通过，0 失败，0 跳过 | 0 |
| `python3 -m unittest discover -s tests -p 'test_native_entry_host.py'` | 3 通过、2 个 Windows 原生用例跳过 | 0 |
| `npm run validate` | 18 个组件通过 | 0 |
| `npm run build` | TypeScript / Vite 新构建通过 | 0 |
| `git diff --check` | tracked diff 通过 | 0 |
| `node tests/native-entry-browser-check.mjs` | setup 失败，checks 为空，starts/stops/opens/managedStarts 全为 0 | 1 |
| `node tests/entry-control-browser-check.mjs` | setup 失败，checks/network 为空，starts/stops/entryCalls 全为 0 | 1 |
| `node tests/s1-browser-check.mjs` | CDP_CLOSED，results/network 为空 | 1 |

除只读 diff 检查在主仓库执行外，命令均在隔离 `source/workbench` 执行。三个浏览器脚本均报告 cleaned=true；全量 Node 测试临时根仍有 p2-entry 测试目录及 Node 缓存，保留在本批隔离目录，不声称全目录清空。没有真实 Hermes/模型、依赖安装、真实实例更新、提交/推送或正式集成。包装脚本退出 0 只表示收集流程结束，**不能掩盖三个浏览器命令退出 1**。

**结论：单元/合成接口、结构检查和构建通过，浏览器端到端仍阻塞。** 现有证据只能定位为浏览器/CDP 准备阶段未完成，尚未进入页面业务断言；不能据此声称页面有业务缺陷，也不能声称环境问题已确诊或页面通过。后续需获批收集隔离 Chrome 启动诊断、修复确认的问题并重跑浏览器批次；不绕过 sandbox 或安装门禁。employee 已在群内报告恢复接入，未派重复页面开发；独立审查及 Windows 实机门禁继续保留。

### NATIVE-01 公司侧暂不可用期间的 lead 客户端开发

用户说明 reviewer/employee 暂时无法接入，要求先完成 lead 自己的开发；不将等待公司侧作为停止核心编码的理由，也不以 lead 自审替代独立复审。

- 新增 `src/domain/native-entry.ts`：固定同源 status/start/stop/open 请求，无任意 URL/命令/路径参数、无请求正文，拒绝重定向；正文读取限 4 KiB，严格校验状态组合和 202 accepted 响应。accepted 只表示请求已接受，不能直接当作 running 或停止完成。
- 新增 `src/hooks/useNativeEntry.ts`：管理身份代际隔离、卸载取消、同步重复操作门禁、请求全程截止；动作应答后重新读取状态。断线/超时/异常保持 unknown，不自动重试或重启；客户端 abort 不被视为服务端动作已取消。初始 unknown 必须显式刷新为 idle 才允许启动。
- 展示层接入契约：`useNativeEntry(managementToken)` 返回 `status:{kind,state}`、`pending`、`failed`、`canInspect`、`refresh()`、`act(action)`；kind 为 null/cli/dashboard，state 为 idle/starting/running/stopping/unknown，action 为 cli/dashboard/stop/open。展示层不得自行 fetch、持久化凭据或推导启动成功；按钮禁用不能替代服务端互斥。open 仅允许已观察到 running 的 dashboard；最终仍由服务端重核所有权与活性。
- 新增 `tests/native-entry-client.test.mjs`，覆盖响应拒绝、固定请求、重复动作、动作后状态重核、身份切换迟到成功/失败、卸载及失败后禁止自动重启。**下方 42 项通过证据只覆盖此前固定快照，不覆盖新增客户端和页面。**
- 按用户“继续推进，直到完成你的全部任务后再汇报”继续收尾：lead 补齐最小 `NativeEntryPanel` 并在 `SettingsPage` 实际调用 hook、绑定刷新/CLI/Dashboard/打开/停止动作，不再等待公司侧组件才能接线。启动/停止要求逐次勾选风险确认；身份切换重置确认，pending 禁止重复操作，unknown 禁止启动，保留显式刷新/停止。原资产面板文案改为只描述资产观察，不与独立生命周期控制区矛盾。没有部署或实际启动原生入口。
- 补齐 `native-entry-panel.test.mjs`、既有 `merge-handoff.test.mjs` 的真实模块导入与 SettingsPage 断言，并新增 opt-in `native-entry-browser-check.mjs`。浏览器脚本使用真实构建页面、原生 fetch、管理 HTTP 和真实隔离实例锁，但注入合成进程适配器；检查未认证/未确认禁止动作、启动中门禁、明确打开、停止后释放、失败 unknown、管理身份撤销；不运行真实 Hermes/模型。
- **编码收尾状态**：计划内后端核心、固定适配器、生产启动器/包策略、客户端状态管理及最小页面动作均已写入。本轮新增前端及页面已纳入上节全量测试和构建，浏览器检查在准备阶段失败；独立复审、Windows CLI 交互和进程树、U盘验收仍待，不改变 release_ready。
- 原集中验证申请已获批准并执行，结果见上节。新增诊断范围及重跑须总监决定；失败先汇报，不自动无限返工。

### NATIVE-01 首轮隔离验证结果

- 代码身份：上述 HEAD 加本轮未提交源码；复制受控源码到独立 scratch 目录，复用现有 node_modules，只在隔离树构建。完整源码清单 `source-manifest.json` 的 SHA-256 为 `2aaf5dea1ee006eb36e4bdce7d094398df4ac2633d8a1bfdbbef18094953df75`，HEAD 本身不包含本轮实现。本机证据目录为 Profile scratch 下 `native-01-verification-34v93jhn`，保存逐命令日志和 `results.json`；这是本机证据，不代表公司已取得审查材料。
- 在隔离树 `source/workbench` 执行 `node --test tests/native-entry-session.test.mjs tests/native-entry-manager.test.mjs tests/native-process-protocol.test.mjs tests/native-entry-adapters.test.mjs tests/native-entry-control.test.mjs tests/native-owned-process.test.mjs tests/legacy-entry.test.mjs tests/managed-native.test.mjs tests/open-local-browser.test.mjs tests/portable-native-entries.test.mjs tests/package.test.mjs`：**42 通过，0 失败，0 跳过，退出 0**。
- 同目录执行 `python3 -m unittest discover -s tests -p 'test_native_entry_host.py'`：**3 通过，2 跳过，退出 0**；跳过的是 Windows 直接子正常退出后后代清理、父管道 EOF 后整树退出两项。跨平台 mock/管道契约不构成 Windows 原生证明。
- 同目录 `npm run validate`：17 个组件结构检查通过，退出 0；`npm run build`：TypeScript/Vite 通过，退出 0。主仓库只读执行 `git diff --check`：退出 0，仅覆盖 tracked diff，不作为新增文件行为验证。
- 覆盖真实隔离文件/锁、合成回环管理 HTTP、注入适配器/进程/浏览器及包夹具；未启动真实 Hermes、真实浏览器或调用模型，未安装依赖、更新实例、提交、推送或正式集成。验证期间原工作区源码哈希未变化；临时夹具退出后仅余 Node 编译缓存，构建产物留在隔离树。
- **结论：本批本机检查通过，完整工作包仍待验证/开发。** 未运行全量 npm test、浏览器端到端、Windows/U盘验收；独立复审未完成，展示层与完整使用链路未完成。不得据此冻结为已验原生接口或改变 release_ready。没有失败项、没有执行修复重跑。

### NATIVE-01 接管编码增量（编码时未测，首轮证据见上节）

- 新增 `native-entry-host.py` / `native-owned-process.mjs` / `native-process-protocol.mjs`：Windows 10+ 私有 Job 的监督者留在 Job 外，使用 STARTUPINFOEX 的 JOB_LIST 在创建子进程时完成归属，避免“先创建再归入”之间监督者崩溃留下孤儿；不支持时拒绝，不走无约束降级。Dashboard 仅继承明确列出的三个标准句柄，CLI 创建独立交互控制台；原 `windows-job-host.py` 的既有 WIP 保留，不将其普通 host exit 当作新入口的树退出证明。
- 新监督协议仅发送 started / port / failed / closed 白名单事件；业务输出丢弃，不能伪造 closed。只有 Job active=0、直接进程退出、输出排空且 host 正常退出才向 session 提交 treeExited=true；管道失联、协议异常或停止超时均不据此释放锁。CLI 的 ready 表示受控进程已创建，不冒充 CLI 提示符或键盘交互已经验收。
- 新增固定版本 `native-entry-adapters.mjs`，依据本地 Git 对象 `28044757aabd34010bd9f5f3e3f82b0906b46241` 的 main/subcommand/web_server 源码核对命令：CLI 强制 --cli；Dashboard 固定 isolated、loopback、动态端口、no-open、skip-build。显式 HERMES_WEB_DIST 指向已存在且非链接的固定资产，避免上游 skip-build 缺资产时自动恢复构建；拒绝未知版本、tracked dirty、源码 .env 与非法资产。复用带单次令牌的只读 RPC 健康检查，打开前再次核对活性；URL 由服务端生成，不传凭据，不接受浏览器任意命令/路径/URL。
- 生命周期补充确认退出后的锁释放等待与 Dashboard 显式 open；管理服务新增固定 `/api/native-entry/dashboard/open`，与启动/停止共用认证、Origin、busy 和无正文/无参数限制。新增/扩充 protocol、adapter、session、HTTP 与 Python host 回归源码；Python 用例区分 mock 契约和原生 Windows 进程句柄验证，全部尚未执行。编辑工具的语法反馈不是测试、构建或 Windows 验收证据。
- **续开发增量（源码，尚未验证）**：已新增 `legacy-hermes-entry` 前台协调入口，将 Windows `launch.bat` 的受控命令路由至共享 home 锁；拒绝 daemon/service、跨 Profile 和运行环境更新路径。P2 模式的 doctor 走协调入口，更新菜单停止而不绕过锁执行。旧版本启动器、Gateway 收据及安装/恢复标记通过 `portable-entry-guard` 拒绝，不清锁、不接管外部进程。该 guard 是安装一致性检查，不是防本地修改的安全沙箱。
- `launch-managed` 已传入 `createPortableNativeEntries`，接上固定适配器、浏览器打开与持锁后 guard；Windows managed serve 同样改用 Job 外监督和完整树退出证明。补充包白名单与入口版本清单，P2 payload 仍不覆盖 P0 启动器：已有安装需有匹配启动器，否则拒绝启动，不能将本次源码直接视为现有安装的可用更新包。
- 新增/补充 managed 锁释放、native transport、受控浏览器、legacy 互斥、生产组合、HTTP 并发与关闭重试、Windows 父管道 EOF 退出用例源码。协议流 error 即使后续收到合法 closed 帧也不确认退出。启动器清单随本轮改动重新计算；上述用例均未运行，不能称为已复现或已验证修复。
- **剩余门禁**：核心接线与旧入口协调的前次定向测试/静态检查/构建已通过；后续新增客户端与页面动作已写入但未验证。独立复审与 Windows 交互/进程树验收未完成，接口尚未冻结，端到端交付未完成，公司侧暂不可接入。因此 P2-09-NATIVE-01 不报已验完成或可用，正式集成不推进。源码未提交/推送，未安装依赖、更新实例、调用模型或改变 release_ready。

用户确定：CLI 与原生 Dashboard 从工作台打开并正常使用后才进入正式集成；lead 先完成核心开发，再下发展示层任务。TUI/Desktop 不混入本版。公司侧维持暂停。

历史基线 dev/lead `289e285e38d9dd32a212f951c95ecd13ca48d809`。reviewer 报告该版本 Windows Python 12/12 通过、退出码传播缺陷关闭；这不是 lead 本机自测，也不覆盖本轮新监督器。下方有关该生产缺陷仍阻塞的文字为历史记录。

历史内部模块批次：新增 native-entry-session 生命周期模块及直接调用它的回归，固定 cli/dashboard 两种模式，启动前置 busy 门、持锁准备、启动结果不明时保留锁、完整树退出确认后才释放。当时仅内部模块，未接真实适配器、HTTP、打包或页面。总监批准后 lead 在 workbench 实际执行 `node --test tests/native-entry-session.test.mjs`，3/3 通过、零跳过、退出码 0；代码身份为上述历史基线加两个当时未提交新增文件。证据仅覆盖当时合成适配器下的重复启动、退出确认/保留锁与非法入口拒绝，不覆盖本轮修改、真实锁、进程或 HTTP。当前实现及待验状态以上方 NATIVE-01 增量为准。

## 双分支审阅与 P2-CLI-BASELINE-04

lead 已实际获取公司 `4136c30c08847b68656982b3d6971b5333935142` 并只读审查三文件与生产 Job Host，未运行测试。公司批次需返工：T1 没有 ready/go 争抢屏障，固定 sleep 清理、异常路径及退出等待不完整，Test 5 实际同进程却称子进程；生成脚本的换行转义与逐行读取须核对实际提交。T2 直接子立即退出后再 OpenProcess 存在竞态。生产退出码失败仍阻塞，核心修复归 lead。reviewer 对 lead `399e93767113a95c59bb8404dcba9da2d14661f3` 的定向 97 pass/1 skip、validate/build 通过仅为公司证据，浏览器未测；需补完整命令、退出码和固定代码身份。正式集成不推进。

下一工作包 P2-CLI-BASELINE-04：employee 在 dev/company 从上述公司 SHA 出发，仅修改原三文件。T1 建立双子 ready/go 屏障、持久逐行消息队列、有界退出及失败清理，取消固定 sleep；T2 以握手确保取得本批句柄后才允许直接子退出，所有 reader/进程有界回收，保留退出码 42 的失败断言和生产 containment mock；T3 更正证据层级并记录精确命令/退出码/环境和未测项。reviewer 在 employee 暂停后独立复验，原生产失败不要求伪造全绿；不得改生产实现、接口、依赖、真实实例或锁。验证沿用 BASELINE-03 范围，任何新清理故障停止并上报；同一失败最多三轮。详细验收见本轮群聊原始任务单，回交固定 base/result 与远端确认，不改写共享历史。

## 当前交付：三分支开发检查点

用户批准三分支方案，lead 已从共同基线 6e2f64a 创建 dev/lead，发布能力 API/页面接线及规则文档供 reviewer 取得精确源码。最终 SHA 和远端回读见本轮交付消息；不自引用提交 SHA。正式集成分支本轮不推进。公司 CLI-BASELINE-03 返工按回交属于“测试交付已修正，Windows 退出码生产缺陷仍阻塞”，不是整包功能通过；公司三文件由 employee 发布 dev/company 后再由 lead 获取审核。

本次没有新增测试执行：既有 360/360、17 组件、构建及浏览器 12/19 项为此前运行证据。阶段性 lead 复验仍待总监决定；公司 reviewer 按任务范围复审两侧固定提交。E 盘、真实模型、锁与发布资格均未变更。

## 最新派单：P2-CLI-BASELINE-03

- 用户要求避免零散补丁派单并允许经理直接向员工下发任务；本轮直接下发同一工作包的 T1 锁并发/隔离、T2 Windows Job Host 补证、T3 验收矩阵，由组长负责日常返工及实际测试后汇总，详细边界见 HANDOFF 顶部。
- 本机只读重核 HEAD 为 `6e2f64ae947117f6ccbf1efda1b55cb0e2394e4f`，保留现有全部修改；公司任务仅动不重叠的三文件，不依赖未发布的负责人核心。负责人本轮没有运行测试/构建、fetch、提交或推送。
- 已核对现有 Windows host 子 stdin=DEVNULL，不能直接当作交互 CLI 实现。员工仅补既有安全基线测试，不改核心监督或启动器；CLI 核心由 lead 后续负责，阶段性验证先报总监决定。源码传输及独立复审门禁保持未关闭。

更新：2026-10-14。**入口能力面板与版本化只读 API 已在本地接线并通过浏览器验证，尚未提交或部署；备用入口启动/互斥仍未完成。S1 未完成实机验收，P2 非 RC。**

## 2026-10-14 VIEW-02 获取、修正与页面接线

- 用户授权公司两个新增文件提交推送；负责人实际 fetch 并核对 `980d42c..6e2f64ae947117f6ccbf1efda1b55cb0e2394e4f`，确为组件与测试两文件。在独立 detached worktree 复跑原 12 项 SSR 全通过；原主工作区 7 个 WIP 文件先备份，确认与来件无重叠后快进至 6e2f64a，逐字节核对保留。
- 实际审查仍发现语义问题：未认证提示错误要求连接实例；unknown 写成探测未接入；总标题把 missing/invalid 也概括为检测到文件，且 TUI/Desktop 检查的是目录。新增两项行为断言在公司提交上失败后修正；补 enabled/不自动回调测试，旧结果隐藏断言同时检查列表不存在。组件最终 15/15，不将原缺组件导入失败当作行为红灯。
- 负责人新增严格 schemaVersion=1 客户端 decoder、16KiB 响应体限制、7 秒读取截止和新 hook；未知版本/重复或缺失条目/错误状态/意外允许启动均拒绝，不接收路径或任意错误文本。请求及身份代际隔离、旧正文成功/失败、卸载取消已覆盖。SettingsPage 实际调用新 hook 并接入公司组件；legacy API 和 hook 保留兼容，不启用启动动作。
- **本轮命令及结果**（主 workbench，分别退出 0）：定向客户端/面板/设置页 34/34；`npm test` 360/360、零失败零跳过；`npm run validate` 17 组件；`npm run build` tsc/Vite 通过；`node tests/entry-control-browser-check.mjs` methodVersion 2，12 项；`node tests/s1-browser-check.mjs` methodVersion 3，19 项。`git diff --check` 通过。
- 浏览器实际构建页面点击触发新 API，证明未认证不自动检测、无需启动 Hermes 即可检查、工作台与原生 Dashboard 分开、失败清旧结果、重试恢复和跨页管理身份撤销。检查到本轮单次点击对应一次 inspection。初次浏览器验证在重载后的 idle-status 设置阶段失败，未到达新入口验收；将夹具改为同一已加载页面内导航后通过，不冒充修复了生产启动故障。两组浏览器 cleaned=true；真实实例、模型和 Windows 终端均未执行。
- 当前主 HEAD 为公司 6e2f64a，负责人 API/接线/修正仍是本地未提交修改，HEAD 本身不包含全部新功能；没有推送、更新 E 盘或重打安装包。公司保持暂停写入；负责人新增核心仍待独立复审。完整 CLI 启动与共享 home 互斥/Windows 进程生命周期是下一核心批次，不能用只读面板完成替代。

## 2026-10-13 ENTRY / LOCK 整合验证

### ENTRY-CAP-02 开发首批与 VIEW-02 派单

- 用户要求开始开发。负责人基于 `980d42c` 亲自实现版本化只读资产能力 API，生产 control-server 已接入、打包白名单已增加模块。四个代码/测试文件为 `scripts/entry-capabilities.mjs`、`scripts/control-server.mjs`、`scripts/package-policy.mjs`、`tests/entry-capabilities.test.mjs`（相对 workbench）。旧 API 及当前 UI 保持兼容，没有启用任何备用入口。
- 先运行新测试 8 项：原基线 1 通过/7 失败（新路由未实现导致 404/缺响应字段，不是历史生产故障复现）；实现并补充并发/投影/关闭/截止/断开测试后 15/15。主工作区最终 npm test 329/329；同一生产代码的 validate 16 组件、tsc/Vite build、既有浏览器 v1 10 项和 v3 19 项全部退出 0；浏览器验证旧页面无回归，不是新能力面板验收。未启动真实 Hermes 或调用模型（仅合成回环管理 HTTP），未改生产锁，未执行 Windows 验收。
- 新接口仅输出固定版本、五类资产元数据状态与禁止启动原因；根内链接拒绝、认证和 Origin、无参数、并行上限、超时、关闭取消及错误投影已有真实回环 HTTP 测试。依赖/运行/启动安全性仍明确未验证，文件检查不能替代后续启动时重新校验。
- 正式下发 **P2-ENTRY-VIEW-02** 给公司 employee：固定接口下的两个新增展示层/测试文件，reviewer 独立复核；允许文件、props、案例和禁止项见 HANDOFF 最新节。核心锁与 Windows 交互监督仍由负责人负责，尚未完成。当前均未提交推送或部署，不改变 release_ready。

### 后续回交与当前派单

- 用户实机反馈：读取历史正文、连接实例现已正常；仅记这两项通过，不扩展为审批、断线、跨实例或四入口验收。公司 reviewer 已对 `980d42c46e207be63528c103531ff2472d9ae1a8` 回交 APPROVE；公司 Windows 全量为 305 通过、9 跳过，定向 59/59、validate/build 通过。此前独立复审未完成状态由此更新，实机其余门禁保留。
- 当前正式批次 **P2-ADAPTER-CONTRACT-01A**：对应 P2-09 四入口的只读证据盘点，作为负责人制定启动/打开接口的前置，不启动 S2/S3 核心实现。基线 `980d42c46e207be63528c103531ff2472d9ae1a8`；具体分工和边界见 HANDOFF 顶部。本轮只维护文档，没有再次构建、提交或推送。

- 用户授权各方提交推送并由负责人检查合并；共同基线 `4b2f38f648441a95923e89470ce497edc1efce09`，负责人修复 `4ff953c31335ada8581afd541bb6acaa8d0cdbf6`，公司 LOCK 测试 `d0c5fb388887f542417e4a10dbb079508d874e1a`，代码合并提交 `2cd4c0aa3a6d55ded3e406c36f71c02c017775c6`。保留双方历史，未改写提交；最终文档提交和推送结果以交付消息及远端回读为准。
- 负责人修复入口普通文件判断、检测请求与迟到正文隔离、卸载取消、错误优先展示及跨页管理身份撤销；管理失败保持 `OPERATION_FAILED`，新增固定白名单 `reason`，不输出原始异常/路径/令牌，不自动重试或回收锁。没有新增依赖或持久化。
- 审查公司测试时发现 Test 5 清理会越出自有 assets 目录，尝试删除共享临时根下的 `.p2-manager-lock`；在运行该交付测试前移除越界清理。另将无条件抛出获取结果改为意外获取时释放自有锁并明确失败，补 `reason=INSTANCE_LOCKED` 和 owner 原文保留断言，避免泛化 500 掩盖错误来源。生产锁算法不变。
- **本次实际执行**：隔离合并树与主开发工作区分别执行 `npm test`（314/314、fail 0、skip 0）、`npm run validate`（16 组件）、`npm run build`（tsc/Vite）；`node tests/entry-control-browser-check.mjs`（methodVersion 1，10 项）、`node tests/s1-browser-check.mjs`（methodVersion 3，19 项），各命令退出 0，浏览器 cleaned=true。隔离树另执行 LOCK/control-failure 定向 14/14。命令工作目录均为对应 workbench。
- 上述浏览器使用实际构建 React/Chrome 与回环 HTTP，实例启动失败及 RPC 为合成；未调用真实模型，不代表 Windows 实际启动故障已关闭。此前公司 Windows WIN 夹具验证及 LOCK 5/5 是公司回交证据，不冒充负责人 Windows 实测。
- 主仓库原三份文档先完整备份，快进后逐字节核对保留，再补本轮记录；没有覆盖原文档修改。隔离旧记录仍保留，当前任务状态以本节为准。
- **剩余门禁**：负责人生产修复的独立复审此前因额度错误未完成，不能记作独立通过；Windows/U盘、真实模型/审批仍待环境验收。CLI/Web 只检测入口文件，TUI/Desktop 未实现探测，四类原生入口启动与生命周期未完成。未重打安装包、未更新 E 盘、未删除真实锁，`release_ready:false` 不变。

唯一分支：`feat/portable-initializer`，已整合 dff159b 与 190cc89。
本文件是任务状态唯一入口；证据见 [VALIDATION](VALIDATION.md)，协作见 [HANDOFF](HANDOFF.md)。

## 2026-10-04 负责人进度回交

- 核对基线：`3252643887c61489ef3cfc6b1a2457a968ee3ab2`；本机工作区干净，远端 `feat/portable-initializer` 同 SHA。本次只更新负责人进度，不修改实现、不启动新开发或发布。
- 已完成（仓库记录）：S0 两线整合与构建修复；`c266409` 定向安全修复；`3252643` 协作执行与证据规则整理。具体修复范围及历史测试证据见下文及 VALIDATION。
- 测试：此前记录为 Linux 自动回归 172/172、16 组件检查及构建通过；本次未复跑应用测试或构建，不把历史结果当作当前实机验收。
- 未完成：S1 浏览器/真实接口整合复验；S2 学习实际产出、可信证据与受控实例持久化；S3 真实更新、入口检测与恢复等后端；S4 集中测试包及 Windows/U 盘验收。真实模型/审批闭环仍未验证，`release_ready:false` 不变。
- 交接：公司开发者与审查者分别回交自己的精确 base/result SHA、文件范围、实际命令和退出码、失败/未测项及剩余问题；本记录不替他们认定完成。负责人收到结果后核对差异，先确定唯一写入者，再下发或审查一个小批次；新功能暂停约束不因本次进度上传解除。
- 本批仅文档，没有新增依赖、接口或存储变化；不上传个人配置、令牌、会话、构建产物或公司业务数据。

## 先做什么

此前用户要求暂停新功能，先定向审查 dff159bed2c275d1b6a9c7c0c04c5b7bddf58bda；2026-10-04 已要求继续推进 P2，当前按下述小批次收口，不同时开展 S2/S3。
基于 8fe9843 的隔离修复已覆盖证据投影/不授信、存储拒绝、更新兼容门禁、恢复风险与夹具认证盲区；
用户随后授权修复并推送：补丁已应用到 feat/portable-initializer，原开发工作区复跑 172 项自动回归、16 组件检查和构建通过。
完整范围和未测项见 VALIDATION 的“dff159b 定向审查修复”；当前批次不启动 S2/S3 新开发，不改变发布资格。

1. S0 现场保存与两线整合已完成；两处 TypeScript 构建错误已修复。
2. S1 卡片管理服务接线、提交前重核和学习来源已接入；固定交付的生产守卫与调用点行为变异测试、R2 两项夹具修复和 R4 真实管理 HTTP 测试已统一整合。2026-10-08 在同一整合树上直接 Node 与 npm 各 216/216、16 组件检查、构建及实际 Chrome/React → 真实管理 HTTP 的 8 项检查通过。RPC 仍合成，真实 Hermes/模型审批及 Windows/U 盘未验；S1 不宣称全链路验收通过。旧 Windows 203/205 等记录保留在 VALIDATION，不代表当前 Linux 整合树结果。
3. S2 学习产出关联、可信证据、实例环境与受控持久化尚未完成。
4. S3 配置/真实双通道更新/原生入口、会话恢复、视觉与无障碍待完成。
5. S4 满足开发门槛后生成集中包，Windows/U 盘缺环境时明确待验。

双方只用同一分支，顺序交接精确 SHA，不同时开发和推送。

## 当前派单与回交（2026-10-04）

### 2026-10-13 WIN-BASELINE-01 正式派单

- 基线 `7a85c864cb39f9859fe9f3bb0863ff0b747b6d35`，本机核对工作区干净、分支/远程配置无变化。本轮仅更新文档，不宣称公司新任务已经执行。
- 公司回交证据：实现者报告 Windows 全量 280 项中 270 通过、1 失败、9 个 POSIX 跳过；审查者报告 HISTORY/相关管理测试 57 项通过、原 BLOCK 解除。归属为公司侧证据，不是负责人 Windows 复跑；recovery-marker 失败在前后基线均出现，根因仍未确认。
- 当前唯一实现批次 **P2-S1-WIN-BASELINE-01**：公司实现者负责原失败诊断与有证据支持的最小测试夹具修复，审查者先只读、回交后隔离复验；核心启动/锁/恢复机制若需修改，由负责人收回直接实现。具体文件白名单、先红后绿、验收与补丁回交规则见 HANDOFF 最新任务单；本批不提交推送。
- 下一候选为接口契约确认及 **P2-S3-ENTRY-01**，对应总任务 **P2-09** 的 CLI/TUI/Desktop/Web 四入口检测、接线及生命周期子批次；此处明确关联，不表示已正式启动或已完成 P2-09。不混入本次 Windows 夹具修复。

### 2026-10-13 HISTORY Git 交付批次

- 用户追加授权提交推送；目标为 origin/feat/portable-initializer，不修改 main/upstream。推送前远端 ref 实查为 e83f060，与本地 HEAD 一致；11 文件修复与已验证交付清单逐项哈希一致，四份文档随本批保存。下方“未提交/未推送”保留为先前阶段的历史记录。
- 本轮再次执行直接 Node 全量 280/280、validate 16 组件、tsc/Vite 构建与实际浏览器 v3 的 19/19，均退出 0，cleaned=true。与前次本地整合复验分开保存证据。
- 不扩大为公司侧工作区覆盖、Agent 追加任务、安装包重打、真实实例更新或发布。公司未提交四文件仍须受控保存/比对后才能同步，不能直接覆盖；Windows 既有失败和真实环境验收继续保留。

### 2026-10-13 HISTORY 本地整合与复验完成

- 用户明确批准本地整合与验证，暂不提交推送。接手仍为 c346ab4 加四份文档修改，无其他未提交/未跟踪内容；文档已完整备份并记录哈希，确认与 c346ab4..e83f060 无路径重叠后快进至固定 e83f060，再应用已交付修复补丁。
- **实现**：11 个修复文件逐一匹配此前交付清单哈希；四份文档在快进和补丁应用后逐字节保留，再追加本轮记录。修复现已在本地 feat/portable-initializer 工作区，不再只是隔离 worktree 产物；HEAD e83f060 本身不包含这份未提交修复。
- **本轮主工作区测试**：直接 Node 与 npm 各 280/280，零失败/零跳过；validate 16 组件；tsc/Vite 新构建及浏览器 v3 的 19/19 通过，cleaned=true。不是引用上一轮隔离结果，证据见 VALIDATION 最新节。
- **边界**：未创建提交、未推送或联网同步，未修改公司现场、U盘或真实实例；未重新生成安装包、未改变 release_ready。公司 Windows 既有失败与真实模型/审批/实机验收继续保留。下一步仅在另获授权后提交/推送及安排公司侧受控交接，目前不追加公司任务。

### 2026-10-13 HISTORY 负责人接管修复回交

- 用户授权审查并接管，本批负责人独立实现，不通知另两名 Agent 追加开发。公司已提交结果 e83f060 在本机 Git 对象中可读；四文件未提交补丁只收到公司机器路径与摘要，未取得字节，不冒充已应用该补丁。
- **实现**：基于 e83f060 的隔离 worktree 修复代理正文超时、管理 busy 阻塞、断开与停止/关闭取消、响应投影不匹配；恢复能力/学习 RPC 身份与管理认证分离，补断线正文清理和错误文案。保留解析后会话 ID 合法变化，不恢复旧会话执行；新增回归与浏览器夹具修复共 11 文件。
- **测试**：最终直接 Node 与 npm 各 280/280；validate 16 组件、tsc/Vite 构建通过；实际 Chrome/React/管理 HTTP、合成上游/RPC 浏览器 v3 为 19/19。新增 16 项在原 e83f060 上 2 通过/14 失败，最终补丁应用树 16/16。精确命令、身份和验证层级见 VALIDATION 最新节。
- **交付状态**：完整受控源码补丁已生成并在精确基线上验证可应用；本机开发分支仍 c346ab4，原工作现场保留，未整合、未提交/推送、未重打包或更新实例。
- **剩余门禁**：公司 Windows startup recovery marker 失败仍待平台复验；真实模型/原生审批/Windows/U盘未用本轮结果替代。下一步是确认整合范围后应用修复并重新验证，不启动依赖此门禁的 S2/S3 或 RC；不要求用户现在测试零散补丁。

### 2026-10-12 群聊正式派单与需求队列

- 统一 base：`c346ab4595ab4e3326f0b6f3c2f4bfd555c96835`，分支 `feat/portable-initializer`。负责人本机重新核对 HEAD/远程配置/干净工作区后，仅修改本轮文档；没有运行应用回归或提交/推送。
- **P2-S1-HISTORY-01：正式下发**给 @usb-project-employee，唯一实现/测试代码写入者；先失败测试再修复。生产调用点和实际页面均要覆盖，不续跑旧会话。公司不修改本轮阶段文档，证据以群聊和完整受控补丁回交，由负责人统一登记。
- **P2-S1-HISTORY-AUDIT-01：正式下发**给 @code-reviewer，先在固定基线上只读追踪历史状态生命周期，提供独立失败案例矩阵；收到精确补丁后再独立回归。两名公司 Agent 报告相同仓库路径，须确认是否共享同一目录；实现期间审查者不在该目录跑会生成产物的测试、不修改文件。
- 公司实现者报告基线测试 250 项：240 通过、1 失败、9 跳过；失败为 startup rechecks recovery marker。尚缺原始断言、逐命令退出码和独立复验，不能认定为已知 Windows 根因或“无影响”。历史 VALIDATION 的 Windows 两项失败为其他测试，不可混用。允许隔离推进 HISTORY，但 S1 全量验收保持阻塞；证据到齐后另拆 WIN-BASELINE 小批次，不混修。
- **P2-ADAPTER-CONTRACT-01：负责人本轮完成需求边界登记，详细接口调查待下一批**。固定 Hermes/CC Switch 参考身份、许可证、现有命令与配置能力、凭据写入/导入及探测威胁模型先于实现；不宣称 CC Switch 已集成。
- 后续候选顺序：HISTORY 复验及 Windows 基线失败分流 → 契约确认 → P2-S3-ENTRY-01（四入口检测、可用性与生命周期、网关中文解释）→ P2-S3-MODEL-01（中文首用与手动新增/切换、公私分类、受控测试）→ P2-S3-ENV-01（首页网络/模型/版本与兼容状态）。每批以前批验收 SHA 另行派单，不现在并行写 S2/S3，也不遗忘 S1 审批/断线/能力调用剩余验收。
- 后续需落实：配置向导不得默认安装可选工具或用完成提示掩盖失败；秘密不进浏览器持久存储/日志/导出；私有模型断线不向公有模型转发内容；探测不扫描地址段、不默认发送业务正文、不静默付费。Hermes 与 CC Switch 更新必须经版本化适配和回归，不自动覆盖本地配置。

### 2026-10-12 P2-S1-SYNC-01 三 Agent 协作接手

- 用户授权提交并推送当前修改。本轮同步已积累的修复与中文启动源码、测试、空盘使用说明和交接材料；不上传 ZIP、构建产物、运行时、个人/公司数据或配置，不修改 main/upstream。下面各批“未提交/未推送”均是当时历史状态，当前以本轮交付 SHA 和远端回读为准。
- 用户侧实测反馈（非本机独立复验）：U 盘安装和模型配置已完成；真实模型回复、多轮对话、测试文件读写、活动取消、正常停止重启通过；重启创建新会话，旧会话索引可读取。版本、环境与业务数据未做额外采集，不把这些反馈扩展成全量 Windows 验收。
- **HISTORY-01 待修复**：点击旧会话只读正文后内容一闪消失，多次点击无反应，没有可见错误，主聊天仍能发送；未确认根因，不能说数据丢失或已修复。任务范围与验收见 HANDOFF 首批任务。
- **未验收**：用户明确没有看到审批，文件操作直接完成；审批拒绝/单次批准未触发，不能记通过或直接判失效。断开重连未测试；能力卡片真实调用、提交前重核、学习准备、Windows 后代进程清理和跨实例隔离仍需对应证据。
- **首次配置边界待查**：原生配置向导曾自动尝试安装可选桌面控制依赖并超时，随后仍显示完成式提示；安装器列出宿主用户目录，是否实际写入/残留未知。不得手动重装、提权、修改策略或盲目清理；配置队列与工具开关需后续单独审查，不借本批改内核。
- 当前 P2 没有模型配置保存 UI，使用 launch.bat 的 [2] 原生向导；恢复旧会话继续聊天尚未接入。S2 可信证据/实例持久化/学习闭环，S3 配置/恢复/更新，S4 集中实机验收未完成，不将其混入 HISTORY-01。
- 三方建议：本地负责人审查统筹、公司实现 Agent 唯一写入、公司验证 Agent 独立只读复现；尚未自动派发或启动公司 Agent。接单先同步精确 SHA 并确认写入者，沿用单分支顺序交接，不并行覆盖。
- 本轮重新验证：250/250、16 组件、TypeScript/Vite 构建、浏览器 v2 10/10 通过；这些测试没有复现/关闭用户报告的历史正文问题。详见 VALIDATION 最新节。

### 2026-10-11 P2-S1-LAUNCHER-ZH-01 中文启动界面

- 交付完成：ONLINE-ZH 空盘包 370264 字节、89 个 payload，SHA-256 70fc2ce4c88f206ca1d1f02b77fc228fb9e77dce10e418a24507105956f9c92f，位于本 Profile deliveries/p2-s1-first-install-online-zh-20261011。最终解压代码 17/17、资产/认证 smoke 和真实管理 HTTP 中文命令探针通过；首次仍需联网，旧包不含此中文界面。
- 独立只读审查发现增量打包遗漏双击入口：已将 P2-Workbench.bat 加入 P2 所属白名单并补断言；不扩大增量安装器对 P0 的 launch.bat 覆盖权限。本次 ONLINE 首装归档独立核对包含这两份 BAT，中文主菜单不会遗漏。审查期间的 4 项结果为中间快照，最终新增 5 项、全量 250 项通过。
- 用户要求说明 P2 打开方式并优化启动界面、使用中文。P2 保持默认浏览器中的 Web 工作台，不引入桌面壳或新依赖；本轮不重做浏览器页面、旧 P0 维护菜单或 Hermes 原生向导。
- 实现：launch.bat 首次提示、状态/主菜单/高级工具/错误提示中文化，青色入口、黄色情况提醒；新增 [P] 工作台入口。P2-Workbench.bat 与 START_HERE.md 纳入仓库源码，P2 控制台分区显示状态、基线与操作菜单，支持 1/打开/OPEN 和 0/退出/EXIT。仅给本机无令牌 origin，不输出管理凭据；保留关闭重试和全部底层门禁。
- 检查：新增默认 5 项启动展示/入口静态/真实 line 回调回归；完整 250/250、16 组件、构建、浏览器 v2 10/10 通过。另有真实管理 HTTP + 合成浏览器打开失败探针通过，未启动 Hermes 或模型；详见 VALIDATION。
- 边界：Windows UTF-8/CRLF 与 PowerShell BOM 作静态验证，Windows 控制台字体/颜色、默认浏览器、首装与公司模型仍待实机。基线 b986738 加明确未提交修改；不沿用旧 ZIP 宣称已包含中文，不自动提交或推送。

### 2026-10-09 P2-S1-FIRST-INSTALL-01 空盘联网首次部署包

- 安装包再次复查：实际 ZIP 的 88 个 payload/CRC/清单/哈希通过；解压脚本 12 项回归、包内资产/认证检查、默认 bootstrap 的真实管理 11 项及学习提示准备通过。首次真实管理探针因测试辅助文件未复制失败，补齐探针后通过，未改包内实现。检查范围内未发现新确认阻塞缺陷；Windows 首装、公司下载/策略和模型仍待验。ZIP 不变，具体证据见 VALIDATION 最新节。
- 用户明确要在公司电脑从空 U 盘部署，之前的外壳增量包不满足这一入口。已另生成首次部署联网包，将现有 P0 启动器/初始化脚本/锁定清单与预构建 P2-S1 工作台合并到同一根目录，新增包内 P2-Workbench.bat 和 START_HERE.md；不需要先有 P0。未改内核或锁定 bootstrap，未复制个人运行时/配置。
- 当前交付是 ONLINE 初始化包，不是离线预装包：首次仍需公司电脑下载运行时、内核和依赖；公司外网/脚本策略可用性未知，遇阻停止，不把能访问模型内网当作安装外网可达。解压后依次运行 launch.bat、配置原生菜单 [2]、P2-Workbench.bat；不再要求用户先执行增量安装脚本。
- 源码 b986738 加包内生成启动入口/说明；最终 ZIP 363472 字节、88 个 payload，SHA-256 953030908ecbfdf8920e025c6d3ba0c99fb1db02590dfec0567cc3705e47f76d。本 Profile deliveries/p2-s1-first-install-online-20261009 保留 ZIP、哈希、START_HERE.md 和验证旁车。归档/解压哈希及资源认证 smoke、解压脚本 12 项生命周期回归通过。
- 默认 bootstrap 29112bef099274229cadff79cdff7bf7b99c4b77 的本轮 Linux 隔离真实管理 11 项通过；Windows 首装、公司下载、真实模型/审批仍待验，不改 release_ready。开发机未操作真实 U 盘、未下载或安装 Windows 依赖；本轮仅打包及验证，未新增 Git 提交或推送。

### 2026-10-09 P2-S1-USB-PACK-02 修复提交与替代测试包

- 用户授权提交当前修复并生成 U 盘可用 ZIP。源码提交 4090b4d0846f537ceb832d9f4464af69936ae18e，包含此前已审浏览器入口及三项生命周期修复；本地 feat/portable-initializer，未推送。下方未提交/待打包条目是历史状态。
- 从该干净提交重新跑 245/245 自动回归、16 组件、构建及浏览器 v2 10/10 后打包。最终 ZIP 为 236501 字节、35 个 payload，SHA-256 98d8505f12228a069ebe54d38befd29271e22e1f149060c9f5a94b9a6d32ffde；最终 ZIP 解压后的实际脚本 12/12 生命周期回归，以及临时合成目标安装/备份/数据保留/HTTP smoke 均通过。
- 交付目录为本 Profile deliveries/p2-s1-usb-20261009-4090b4d，含 ZIP、同名 .sha256、使用说明.md、DELIVERY-RESULTS.json。新包作为 P2-S1 集中测试包替代旧包；旧哈希 81a7115b24312ccc3c7573ead37440d56cf41aef374815438f1efefd15e5e49b 仍停用。
- 这是依赖已有 P0 Windows 便携测试根的外壳增量包，不含内核/Runtime/凭据，不是空 U 盘完整安装器；未操作真实 U 盘。Windows/U盘、公司模型/原生审批仍待用户环境验收，release_ready:false。包内文档冻结于源码提交；打包完成证据在旁车及本记录，不回写冻结 ZIP。

### 2026-10-09 P2-S1-REPAIR-01 源码修复与开发侧复验完成

- 修复后再次复查（RECHECK-02）：源码无新增改动，245 默认回归、16 组件、构建、浏览器 v2 10 项再次通过；额外三项独立异常/并发探针通过，详见 VALIDATION。检查范围内未发现新的已复现阻塞缺陷。源码为可进入集中测试打包的 P2-S1 候选；现有 ZIP 仍是停用旧包，不能将源码通过等同替代包已经交付。
- 接管补验：用户确认前一会话因额度停止并授权接管。已保存接手时全部 17 个修改/新增文件及 SHA-256 至 scratch/p2-fix-takeover-20261009。保留既有修复，在旧 HEAD 导出的隔离源码上运行接手的 11 项回归，10 失败/1 通过；当前修复版本同组 11/11。另补健康检查失败后的普通后代清理及重复停止断言，定向 12/12；当前主工作区 Node/npm 各 245/245、validate 16 组件、构建与浏览器 v2 10/10，均退出 0。下方 244 项记录为前一会话证据，本次未重复真实 Hermes 探针。
- 当前三项实现修复与本机开发侧回归完成；未提交、未推送、未生成替代 ZIP，旧包暂停不解除。下一步仅需按集中交付流程重新打包并验证最终归档；Windows/真实模型仍待公司环境验收。
- 用户授权“进行修复”。保留原八文件未提交快照及哈希，在隔离 worktree 补红灯回归、修复，再通过受控九文件补丁应用主工作区；整合前核对原快照未变及修复目标无重叠改动。HEAD 仍 3400686，未提交、未推送。
- 已修复：关闭失败也关闭 HTTP 监听并保留原错误/实例句柄，允许显式重试；启动取得锁后重核恢复标记，拒绝时释放自有锁并保留标记；POSIX 独立进程组停止及直接子进程自然退出时清理普通后代，组消失前不完成 exited、不释放实例锁。同步补齐 launcher 重试路径及 cardId 防御性守卫。
- 隔离与落地工作区均直接 Node/npm 各 244/244，validate 16 组件，构建及浏览器 v2 10/10 全通过；本轮真实 Hermes 无模型隔离管理探针 11 项通过。真实模型/审批、Windows/U盘仍待验，不把该探针拼成模型端到端。
- 本轮只修已确认边界，不新增依赖/外部端点或存储；内部 startManagedInstance 增加持锁 beforeStart 回调，只有实例启动模块传入恢复标记检查。POSIX 主动脱组不在保证范围；组无法确认消失时保留锁与未完成状态。新包须最终归档检查通过才可替代旧包；旧包暂停不解除，release_ready:false。

### 2026-10-09 P2-S1-RECHECK-01 二次审查结论：需返工，旧包暂停测试

- 用户要求再次检查当前代码；主审已复现控制服务异常关闭缺陷：instance.stop 拒绝时，close 在关闭 HTTP listener 前退出，后续 close 永远复用失败 Promise，监听仍存活且所有请求被 closing 状态拒绝。
- 复现针对实际 control-server.mjs，确认其字节与已交付 ZIP 完全一致；旧包 SHA-256 81a7115b24312ccc3c7573ead37440d56cf41aef374815438f1efefd15e5e49b 暂停用于公司测试，等待完整审查与修复。不能再把上方历史“已知问题均修复”作为现行结论。
- 独立审查已回交，主审复跑合成探针确认另两项生命周期缺陷：获取实例锁前检查恢复标记存在竞态，持锁前新增 marker 仍能到达 spawn；POSIX 停止仅终止直接子进程，后代继续活动时已报告 stopped 并释放锁。受影响源码与旧 ZIP 字节一致；不推断 Windows Job Object 路径也失败。
- 2026-10-09 重新执行 232 单测、16 组件、构建及浏览器 v2 的 10 项均通过，说明新增异常路径未被现有验收覆盖。前端 cardId 守卫遗漏属于防御性/测试缺口，当前调用链有其他校验，未认定跨卡误发。完整证据见 VALIDATION。本轮没有修改生产代码或重打包、提交、推送。
- 下一批先补三项生命周期问题的红灯回归，再隔离修复、完整复验并生成替代包；旧包不得据历史全绿恢复测试。真实模型/审批与 Windows/U 盘保持待验，不推进依赖此门禁的后续交付。

### 2026-10-08 P2-COMPANY-TEST-01 开发测试包已生成

- 用户明确将真实模型测试留到公司环境，按其说明可使用公司内网 GLM 5.2；不在本机请求模型凭据或费用授权，不把内网可达性/免费状态当作已验证事实。阶段改为先交可集中测试的开发快照，再由公司环境完成模型/Windows 证据，不将这些未验项伪造为通过。
- 本批范围是 S1 工作台外壳增量测试包，不是 P2 全功能完成：S2 实例持久化/可信证据/学习产出、S3 更新等仍有开发缺口；不因为有 ZIP 就关闭原大任务或修改 release_ready。
- 已重新运行直接 Node/npm 各 232/232、validate 16 组件、构建及浏览器方法 v2 的 10/10。候选包 35 个清单文件，ZIP 清单/CRC/逐文件哈希/敏感目录排除检查通过；临时合成 P0 目标上的只读预检、安装备份、数据保留、锁/标记释放和安装后 HTTP 资源检查通过。
- 公司操作步骤、真实/演示入口区分、停止条件、回交字段和中断恢复统一放在 ACCEPTANCE；使用已有 P0 独立 Windows 测试根，不包含内核/Runtime/配置，不安装依赖、不连接公司服务。包的确切 SHA-256 以最终随包 .sha256 为准。
- Git 基线仍 3400686 加受控未提交修改；包按逐文件哈希标识，不宣称等于干净提交。未提交、未推送，正式发布门禁不变。
- 最终 ZIP 已从归档实际解压，再跑包内安装/HTTP smoke 通过；35 个 payload 文件，外层 SHA-256 `81a7115b24312ccc3c7573ead37440d56cf41aef374815438f1efefd15e5e49b`。本 Profile deliveries/p2-company-test-20261008 中保留 ZIP、.sha256、COMPANY-TEST-RESULTS.json；公司可据包内 ACCEPTANCE 集中测试。此条为打包后记录，不回写已校验 ZIP，不将首轮 S1 测试包描述成 P2 全功能交付。

### 2026-10-08 P2-S1-REAL-NOMODEL-01 真实服务隔离复验

- 工作台基线仍为 3400686 加现有未提交浏览器批次；本轮不改生产代码、浏览器代码、依赖或个人 Hermes。固定 Hermes 源码 28044757aabd34010bd9f5f3e3f82b0906b46241，从本机 Git 对象导出到本 Profile scratch，不将本机当前内核版本冒充此验证对象。
- 已实际运行真实 Hermes 协议与真实管理生命周期两个探针，分别退出 0。协议验证认证、gateway.ready、契约 6、隔离会话创建/关闭、过期请求拒绝、历史读取和缺 provider 的终态错误；管理层 11 项布尔检查全通过，包括认证、单实例、启动/停止与锁释放、本机/外部 Origin。
- bwrap 独立网络命名空间、环境清空、个人 home 隐藏，固定源码与既有 Python 运行时只读绑定；未复制凭据、未安装依赖、未启动工具或访问模型。实际导入路径核对为固定导出源码；结束后无本批自有进程残留。
- 结论仅为“固定基线 Linux 真实服务无模型层通过”，不是浏览器→真实 Hermes→真实模型的端到端通过。模型成功回复、原生审批批准/拒绝、活动任务取消、Windows/U盘仍待验；release_ready:false 不变。详细方法和环境适配失败记录见 VALIDATION。
- 原下一步模型配置/费用确认已由上方公司测试安排替代：真实模型/审批交用户在公司独立测试实例执行，本机不借用个人配置或合成 RPC 补造证据。当前不推送、不正式发布。

### 2026-10-08 P2-S1-BROWSER-RUNNER-01 接管与复验

- 后续收尾：浏览器方法已更新为版本 2，共 10 项；补入真实管理 HTTP 准备延迟期间取消/重导入后无旧审阅，以及二次核验期间断线后显式重连无重放。构建后和直接入口复跑均 10/10；Node/npm 仍各 232/232、validate 通过。本条为当前结果，下方 8 项为版本 1 的历史证据，不相加计数。
- 用户明确授权接管工作区既有浏览器入口修改；基线 3400686。接手时为 package.json 与三个新增测试文件，原样快照及哈希保存在本 Profile scratch/s1-browser-takeover-original，未覆盖来源版本。
- 仓库工作区已有可复跑命令 `cd workbench && npm run test:s1-browser`；重新构建后执行真实 Chrome/React/管理 HTTP、合成 RPC 的 8 项检查。无需 scratch 脚本和额外依赖，不自动安装浏览器或调用模型。
- 本批审查后保留原入口和驱动实现，补齐超大 CDP 帧、预取消等待、预取消入口三项测试，以及 peer error 后后续请求成功的实际断言。驱动 16/16；直接 Node 与 npm 全量各 232/232；16 组件检查、生产构建通过；浏览器初跑和补测后两次运行均 8/8。
- 当前为本地未提交修改，未推送；HEAD 仍 3400686。未修改生产 src/scripts、依赖锁、兼容性门禁、个人配置。仓库内入口已实现并在 Linux 验证，不再把“整理可复跑入口”列为待开发；Windows 与真实 RPC/模型仍待环境验证。
- 下一批：真实 Hermes RPC/审批验证方案，先锁定独立实例、允许数据与费用范围；不直接启动真实模型或跳到 S2 存储。S1 全链路与 P2 验收仍未关闭。

真实链路后续验收按层分开，不把现有探针当作全部完成：
1. 无模型层：已按上方 REAL-NOMODEL-01 在固定源码和独立环境复验协议及管理生命周期。仅覆盖无模型范围，不绕过源码 .env 拒绝与隔离前提。
2. 模型/审批层：需另行确认独立测试实例、模型/费用额度和允许的合成数据；验证允许的一次无害工具操作与拒绝零执行，且证据须来自真实工具事件和目标结果，不由模型自述替代。
3. Windows/U盘层：使用集中测试包验证服务树、迁移和数据保留，保持待环境验证，不要求用户执行零散补丁。

### 2026-10-08 S1/R2/R4 本地统一整合

- 用户同意继续整合；负责人保存既有两份文档修改为 32b27e1，再在独立 worktree 合并固定交付 feac533，并应用已审 R2 与 R4 补丁。未纳入 49e7e7d，未覆盖公司分支或原 R2/R4 审核现场。
- 生产代码保持固定交付三文件的守卫抽取及先核验后提交；整合未新增生产功能、依赖、存储或外部接口。VALIDATION 内容冲突保留双方历史；交付重复审查报告归并为现有 VALIDATION 中的 Git 历史引用。
- 同一整合树：直接 Node 与 npm 各 216/216、零失败/零跳过；validate 16 组件、tsc/Vite build 通过。新构建的实际 Chrome 页面与真实管理 HTTP 8 项检查通过，RPC-only 夹具未覆盖 fetch/XHR。
- 本批仅本地整合提交，不推送、不发布，不调用真实 Hermes/模型；release_ready:false 不变。精确结果 SHA 以开发分支实际 Git HEAD 为准；命令、工作目录及补丁身份见 VALIDATION。
- 下一批先整理可长期复跑的浏览器验证入口及真实 Hermes RPC/审批验收方案，锁定独立实例、数据和费用边界后再执行；不把本次合成 RPC 通过作为 S2 存储实现或实机验收的授权。

### 2026-10-07 负责人临时接管：R4-HTTP-F1 本机完成

- 用户要求负责人暂时承担开发、审查和验证。当前不再向公司 Agent 派单；未假定公司侧写入已经停止，不覆盖其工作区、不推送交付分支。本节取代下方历史写入者安排。
- 基于固定 feac533 新建本机 p2-r4-lead 隔离工作区，自行完成四文件 R4 修复；未收到公司 R4 补丁，故不声称是对公司补丁的独立验收。R2 原现场及未提交补丁保留。
- 无令牌输出的进程内启动接口、真实管理 HTTP/catalog/prepare、RPC-only 夹具和 11 项回归已完成；直接 Node 与 npm 全量均 216/216，validate 16 组件和 build 通过。
- 实际 Chrome + React 页面 + 真实管理 HTTP 的 8 项断言通过；fetch/XHR 保持原生，RPC 合成。覆盖真实目录导出、连接重建、未确认零提交、双击只提交一次、方法变更拒绝和二次核验期间断线。细节与限制见 VALIDATION 最新节。
- 结论：本批 Linux 实现/自动回归/限定浏览器验证通过。四文件补丁已生成且在保留 R2 修改的审核工作区 git apply --check 通过，但未应用、未统一合并、未提交或推送。开发分支本轮只更新两份阶段文档，HEAD 仍 b11bd5a。
- 后续门禁：核对 S1/R2/R4 精确整合范围及授权后统一回归；真实 Hermes RPC/模型审批、Windows/U盘仍待验证。S2 存储实现不启动，release_ready:false 不变。自有浏览器、监听和临时测试目录已清理，无本批后台任务。

此前回交状态（2026-10-04）：R2 补丁 Linux 隔离复验 205/205、validate、build 通过；R3 已在实际 React 构建页面、合成 HTTP/RPC 传输下完成 9 项交互检查，覆盖确认、重复点击、迟到响应、断线重连、实例切换、失败与重导入。详细方法和限制见 VALIDATION；不代表真实后端联合验证或 S1 全部验收。测试补丁仍未应用到开发分支，49e7e7d 不自动整合。

### R4 原任务边界（保留供审查，当前写入安排以上方接管记录为准）

- 目标：消除 R3 浏览器中 fetch 被合成响应替换的覆盖盲区；交付可供负责人浏览器复跑的真实 control-server HTTP 测试入口。Hermes RPC 仍为明确标注的合成传输，不宣称真实 Hermes/模型端到端。
- base SHA 固定 `feac533f42c3ba5431db3079ee283b34e3c18398`，不是 delivery 分支当前 HEAD。员工在独立 detached worktree 开发，回交包含新增文件的受控补丁；不提交、不推送、不合并，不覆盖 R2 worktree。生产开发分支仍为 feat/portable-initializer；交付分支不继续追加。
- 员工为唯一测试代码写入者。允许修改 workbench/tests/s1-control-server.mjs、s1-browser-launch.mjs 及本批新建的 s1-http-harness.test.mjs、s1-rpc-only-fixture.js；必要证据以回交文本提供，负责人写入 VALIDATION。不改 src/、scripts/、依赖/锁文件或包白名单，不重写现有通用夹具。
- 先写会暴露缺口的测试，再实现：入口实际调用 startControlServer；catalog 与 prepare 回调调用 readSkillCatalog/prepareCapability 并指向新建合成 home/skills，不读取个人实例。实例启动回调只返回假连接与可计数 stop，不启动 Hermes；模拟连接端口与管理 HTTP 端口不同，管理/RPC 令牌不同。
- 浏览器侧夹具仅替换 WebSocket，不覆盖 fetch/XHR；页面静态资源、status、connection、catalog、prepare 必须走真实管理 HTTP。保留正常入口与可审计的释放机制，若需延迟控制只能为测试内部控制，不增加生产端点。
- 临时管理凭据不得打印到 stdout/stderr、共享日志或回交补丁；优先通过进程内测试对象交接。若浏览器启动需本机短时凭据文件，先报告目标平台权限方案，不擅自写入普通共享文件。脱敏报告只含端口、计数、状态和布尔断言。
- 验收：真实 HTTP 未认证/错误令牌拒绝；不同管理/RPC 令牌；目录读取不执行 Skill；第一次 prepare 不提交；修改合成 Skill 后第二次 prepare 拒绝 CHANGED；关闭入口清理自有监听与临时目录，不影响其他实例；RPC-only 夹具安装前后 fetch 身份不变。浏览器缺环境只回交“待负责人浏览器复跑”，不安装 Chromium，不把 Node 通过当 UI 通过。
- 每条记录命令、cwd、退出码：新增定向测试、npm test、npm run validate、npm run build。feac533 上未纳入 R2，Windows 原有两项失败须与本批新增回归分开报告；不得为全绿改动这两个测试或偷偷混入 R2 补丁。
- 预算：一个小批次，同一失败路径最多两轮修复；新依赖、接口扩展、真实服务/模型、权限或未知基线变化即暂停。仅已有依赖、scratch 临时文件和 loopback；不安装、不访问私人数据、不启远程监听。
- 审查者先只读核对这份接口/验收边界并回交遗漏案例；员工补丁到齐后再审查精确补丁，不并行修改或替员工提交。重点防止“真实 HTTP”其实被 fetch mock 覆盖、测试入口默认读取个人 home、令牌进入日志、清理误杀。
- 负责人接收补丁后在本机复跑实际页面→真实管理 HTTP→真实 prepare 函数（RPC 合成），独立核对生产调用链。没有真实 Hermes 证据仍不关闭对应 S1 门禁。当前只是派单，未声称员工/审查者已经开工。

### 已回交：P2-S2-CONTRACT-01（只读方案，不启动实现）

双方修正版已收到。本轮未提供已接入生产路径的可复现缺陷；存储/状态/目录摘要相关模块缺生产调用点，属于接入前约束。learningMatches 需结合调用方 epoch/revision 与清理逻辑判断；启动 fragment 是否残留属已接入链路的待验证项，不归为“未接入模块”。不批准简单增加 trusted:true、epoch 参数或替换 postMessage；实例身份、连接代次、方法版本和环境适用性分别定义。方案调查结束，暂不再重复矩阵，也不启动存储实现；以下保留原任务范围。

- 与 S1 剩余运行验证隔离并行；不以 S2 方案开始为由关闭 S1 门禁。分析代码固定 `feac533f42c3ba5431db3079ee283b34e3c18398`，R2 仅改测试不改变契约。最新派单文档位于开发分支。
- 员工：只读追踪 capability.ts、capability-storage.ts、管理服务和 prepare/learn 接线，回交“当前真实调用点 → 缺口 → 最小契约建议”矩阵。仅设计实例目录归属、卡片/证据白名单、方法版本与环境适用性、原子写入/拒绝覆盖、迁移后的复验规则。每条建议标明现有代码位置和需要用户确认的决策；不得用 localStorage 模块存在冒充已接入实例库，不把目录摘要当机器/依赖证明。
- 审查者：对同一 SHA 独立只读列出契约必须拒绝的案例：跨实例读写/旧授权继承、路径穿越与符号链接、敏感字段投影、伪造 verified、方法变更与迟到证据、写入中断保留旧数据。回交最小验收矩阵，不新增独立审查文件。
- 双方本批不修改代码/文档，不创建提交、不推送、不安装/联网查私人实例、不启动模型或服务；在当前帖子回交文本，精确说明源码证据与建议。各一轮分析，出现契约歧义集中列出，不重复运行无关测试。
- 负责人负责综合方案、锁定接口/隐私边界，再单独下发一个最小实现批次；存储方案未获确认前不得落盘接入。需要合并/发布仍单独核对授权。

以下为原始任务及派单时状态，旧“未合并/待派单”仅描述当时现场；当前写入安排与整合结果以上方 2026-10-08 记录和 VALIDATION 为准，整体路线见总计划。

### 已核实提交链

- 开发基线 `ffa1ef07298a18c74618cad110ba9f589af29087`；与交付的共同祖先是 `3252643887c61489ef3cfc6b1a2457a968ee3ab2`。
- 交付提交依次为 `f27876b`（初版）、`fcd8212`（提取生产守卫但引入调用顺序回归）、`284518b`（恢复短路）、`7a655b8`（真实源码 AST 测试）、`451c8f5`（内存变异）、`20e89c7`（行为变异证据）、`feac533`（审查记录）。中间提交不单独作为可交付版本。
- 交付终点 `feac533f42c3ba5431db3079ee283b34e3c18398`，相对共同祖先共 11 个文件；员工结果为 10 文件，审查记录追加 1 文件，不视为冲突。
- 29/29 与 Windows 全量 203/205 为交付方证据，不是负责人复跑结果；浏览器端到端和真实链路仍未闭环。

### 员工任务：P2-S1-R2-WIN（唯一代码写入者）

- base SHA：`feac533f42c3ba5431db3079ee283b34e3c18398`。当前已有 `delivery/p2-s1-r1` 与单分支规则不一致，暂仅保留为冻结交付对象，本批不继续扩散分支或推送该分支；在本机隔离 worktree 以此 SHA 检查和修复，回交完整受控补丁，由负责人审查后统一整合。不得修改原开发现场。
- 目标：定位 `installer.test.mjs` 与 `skill-catalog.test.mjs` 的 Missing expected rejection，区分测试夹具问题与真实平台缺陷。先在共同祖先与交付终点的隔离目录分别复跑并保留失败断言，再制作最小复现；不能只凭 Linux 通过断言 NTFS 根因。
- 允许改动：上述两个测试文件及其确有必要的专用测试辅助文件；回交测试证据供负责人并入 VALIDATION。生产文件只读；若证明为生产缺陷，交回复现与最小修复建议，等待扩展该批范围。不新增长期报告文件。
- 接口契约：安装失败仍须保留/恢复数据；目录碰撞不得放宽为接受；不得跳过 Windows 测试、删除安全断言或把失败改成成功。新增回归先暴露问题再修复。
- 验收：两个场景须分别说明故障注入是否实际发生、观察到的异常/回滚与目录条目；如可在允许范围修复，复跑定向测试、完整测试、validate、build，逐条记录退出码；仍失败如实交回，不以范围外失败冒充通过。
- 环境：仅隔离临时目录、已有依赖、合成文件和本机回环测试；不安装软件，不访问个人配置/公司数据，不调用模型，不操作真实 U 盘或真实安装目录。仅清理本批自己创建的进程和目录。
- 预算：每个失败路径最多两轮诊断/修复，达到上限或出现未知修改、基线变化、新依赖/权限需求即暂停报告；不要循环重试。

### 审查者任务：P2-S1-R2-AUDIT（并行只读）

- 对象固定为 `3252643887c61489ef3cfc6b1a2457a968ee3ab2..feac533f42c3ba5431db3079ee283b34e3c18398`；不再泛化复述 APPROVE，不修改/提交/推送。
- 按 ACCEPTANCE 的 S1 门槛核对真实 React 调用路径、HTTP 与浏览器夹具边界；重点区分域守卫测试与实际断线/迟到响应/重复点击测试。每个缺口给出文件位置、已覆盖层级及一条可执行验收案例。
- 检查新增浏览器启动脚本的临时管理令牌输出、日志分享边界及包白名单；令牌只可在本机临时交接使用，不进入共享证据。核查新增独立审查文档如何并回 VALIDATION，避免重复状态源。
- 一轮只读审查后在本帖回交证据矩阵与阻塞；不安装浏览器、不运行真实实例、不替员工修复，也不替负责人宣布 S1 验收。

### 负责人职责与后续门禁

- 保持开发分支不纳入未验交付；负责 Linux 隔离复验、浏览器环境核对与后续 S1 浏览器补证批次，以及 S2 存储/证据契约审批。派单时仅完成 Git 与静态差异核对；最新复验结果见本节顶部，不声称有后台任务运行。
- 员工补丁和审查矩阵均回交后，先审查精确差异，再决定整合及下一批。真实模型/审批、Windows 服务树、U 盘迁移未验项不因本批关闭而消失。
- 统一回交：任务 ID、base/result SHA（无提交写明补丁）、全部新增/修改文件、命令/目录/退出码、失败和未测范围、接口/存储/隐私副作用、进程归属、下一步建议。补丁须包含新增文件且排除依赖与敏感数据。
- 当前帖子作为协调入口；重启/换会话先读 AI_GUIDE、project_plan、PROGRESS-GUIDE、HANDOFF 和相关 VALIDATION，再核对 HEAD/写入者。收到任务不等于已执行，回交不等于负责人验收。

## 当前任务清单

以下描述整合后的实现范围；已通过构建不等于真实功能闭环或最终验收。
P2-17 保留提交前重核逻辑，仍需浏览器与目标实例验证。

### 任务清单

- [-] **P2-01** 从 Stitch 导出/同步 UI 文件、设计 token、页面清单和交互说明到仓库。六屏已有历史读取与视觉核对记录，颜色/样式仍待校准；映射见 [工程手册](ENGINEERING.md#design)。
- [-] **P2-02** 前端构建、便携包、安装/恢复。已有开发快照与白名单校验，未形成 RC；安装恢复不等于业务任务回滚。
- [-] **P2-03** 适配 `hermes serve` 的方法、事件与版本契约。Linux 隔离探针已有证据；目标 Windows 与真实模型/工具链路待验。
- [-] **P2-04** 自有服务启动、单实例、健康检查、安全停止及断线状态。Linux 已部分验证；Windows 进程树与重连待验，不自动重放消息。
- [-] **P2-05** 对话、流式输出、工具活动、历史会话、日志和错误摘要部分已实现。历史索引与最近 50 条正文只读入口已接入，隔离 HTTP 探针通过；浏览器整合及会话恢复待完成，恢复可能继续执行，必须明确确认与状态核对。
- [-] **P2-06** `/tasks` 已接当前连接的轮次/工具事件、审批等待和中断状态，内部导航保留连接，合成协议浏览器测试通过；模拟流程移至 `/tasks/demo`。真实模型整合与持久化历史待完成，不自建调度器或伪造百分比。
- [-] **P2-07** 适配 Hermes 审批，展示实际提供的原因、命令、范围与风险；未知字段明确提示。已有单次批准/拒绝，真实执行待验；不另建授权系统。
- [-] **P2-08** 展示真实取消、超时、失败与恢复结果；取消不等于撤销。只在具体工具/Skill 支持并验证时显示业务恢复成功，不实现通用一键回滚。
- [-] **P2-09** CLI/Dashboard 生产接线、互斥、页面就绪及失败诊断已有开发实现和分层隔离证据；ENTRY-11集中验证已通过。TUI/Desktop 和 Windows 原生交互仍未验收，不以能力检测代替可用入口。
- [-] **P2-10** 两种模拟流程验证 UI 不绑定业务；保留打印机/文档归档夹具，不再开发独立执行引擎。真实复用验收归 P3。
- [-] **P2-11** 无障碍、键盘、高 DPI、中英文与错误恢复；已有基础样式，完整矩阵未验。
- [-] **P2-12** 盘点 Agent/Profile、提示词、Skills、MCP 的上游接口和版本限制；初步源码矩阵见 [接口清单](ENGINEERING.md#interfaces)，完整字段/敏感信息审计和隔离验证待完成。与 P1 共用配置适配，不另造配置格式。
- [-] **P2-13** 最小配置入口接线：可用 Skills 缓存快照、排除会话读取的 Profile 摘要已接实验页，隔离接口探针通过；选择配置/Skill 与完整真实整合仍待完成。完整创建、搜索、安装和发布管理在 P3 分批接入。
- [-] **P2-14** 汇总集中测试包、哈希、完整操作清单与已知限制；当前清单草案见 [P2 验收](ACCEPTANCE.md)，不得把开发快照标为正式交付。
- [ ] **P2-15** 接入已确认的双通道更新 UI：自动检查与通知、明确确认后安装，内核复用上游更新器、外壳复用便携安装/恢复；兼容性未知不静默应用。当前设置页仅占位。频率、离线退避与更新来源在实现时固化并验证，P4 扩展成熟化而非重复建设。

### 能力复用入口增量（开发中，尚未完成真实闭环）

- [-] **P2-16** 建立“我的能力”卡片入口：已实现定义模型、草稿 JSON 导入/导出、名称/目标/输入项/Skill 或 Bundle 引用及声明指纹展示；新增固定实例 home/skills 子树指纹目录导出，不执行或自动发布。适用环境、依赖、实例库持久化与真实验证证据待接入。卡片不包含自有流程调度逻辑。
- [-] **P2-17** 卡片执行适配：已接单 Skill 的参数预览、当前实例指纹核验、请求审阅、确认后二次核验与 prompt.submit；实例身份/连接代次不匹配拒绝，切换卡片取消准备，当前会话保存卡片 ID/方法指纹及请求。Bundle 不支持，依赖/适用性由 Hermes 在读取方法后实际检查；浏览器防重放、真实 Skill 执行与持久化结果关联待验。Precheck/Execute/Verify 不由 UI 自动推进成成功。
- [-] **P2-18** 从执行记录发起“整理为可复用技能”：已用指纹锁定的上游纯提示构造器准备学习请求，展示来源、范围及全文，经确认后提交当前连接；不经可能执行快捷命令的 command.dispatch。隔离构造器探针和合成浏览器确认链通过。实际 Skill 文件产出、变更审阅、重新验证及证据持久化仍待完成；提示词不是文件写入沙箱。
- [-] **P2-19** 草稿、待验证、已验证、需重新验证已有纯数据判断规则，绑定方法指纹与环境；导入/导出一律为草稿，不携带外部验证证据。可信证据采集、持久化和完整状态 UI 待接入；方法变更不继承旧验证，保留历史成功记录仍需实现。

P2 交付上述 UI/协议适配与测试证据，P3 负责真实方法内容和跨电脑复验。
“一次成功，多次复用”是目标，不表示一次成功后永远有效；草稿与外部未验证 Skills 单独展示。

### P2 验收条件（含能力复用入口）

- Workbench 不依赖解析 TUI 文本获取核心状态。
- 真实聊天、工具活动、审批和取消通过整合验证；模拟与真实界面明确区分。
- 配置与 Skill 入口复用 Hermes 已有能力；任务状态只能来自实际事件，缺少信息不伪造。
- 只有实际支持并验证的恢复才显示成功，不以模拟回滚作为业务恢复验收。
- Workbench 崩溃不会损坏 Hermes 数据，用户仍能使用原 CLI/TUI。
- 能力卡片与实际 Skill/Bundle、版本及证据一致；生成 Skill 不等于验证通过，卡片输入不复制旧机凭据或授权。
- `/learn` 的发起、草稿产出、失败和写入确认有可核对状态；失败经验进入排错参考，不自动标为成功方法。



## 进度报告规则

- P2-09/15 在外部提交有 UI/域逻辑，但真实后端未接，本机主线仍是占位，保持未完成。
- P2-18 学习来源传递与失效处理已接入；实际草稿产出、审阅及证据仍有开发缺口。
- P2-19 的 localStorage 工具模块不是便携持久化设计；需先核定目录、字段与信任边界。
- 不把 151 测试与 115 测试相加作为交付数量，也不依据它们报精确完成百分比。
- 历史浏览器验证不覆盖后续修改；当前证据见 [VALIDATION](VALIDATION.md)。
- 达成 [ACCEPTANCE](ACCEPTANCE.md) 后再更新发布资格，不能为了构建包手改门禁。
