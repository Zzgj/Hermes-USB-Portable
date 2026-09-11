import type { Workflow } from '../domain/workflow';
export const copy = {
  mark:'H', separator:' · ',
  brand: 'Hermes Portable', subtitle: 'AI WORKBENCH', preview: 'P2 开发预览 · 未发布',
  disclaimer: '默认页面使用模拟数据；真实连接实验需单独主动连接，不自动授权任何操作。',
  title: '你的便携 AI 工作台', intro: '一个工作空间，连接对话、工具与知识。',
  navLabel: '主导航', skip: '跳至主内容', toggle: '切换明暗主题', footer: 'P2 开发预览 · 真实连接状态请查看连接实验页 · 不自动更新内核',
  workspace: 'WORKSPACE / 工作空间', newTask: '查看模拟任务', recent: '最近任务 · 演示',
  headers: ['任务编号','操作','状态'], quickTitle: '快速开始', details: '查看详情',
  demoOnly: '仅演示 · 未执行', unavailable: '后端接口待接入', search: '搜索示例条目', empty: '没有匹配的示例条目',
  taskTitle: '工作流任务中心', taskIntro: '步骤由工作流定义生成。审批仅改变页面模拟状态，不代表系统授权。',
  workflowLabel:'选择示例工作流', inputRequirements:'每次执行需重新绑定的输入', workflowVersion:'定义版本', selectionHint:'执行中不能更换工作流；取消或完成后可选择新演示。', recoveryNotice:'取消保留已完成步骤记录，不代表撤销副作用。本演示不证明真实回滚能力。',
  inputHint:'请填写虚构测试值，不要输入凭据。仅保留在当前页面内存；离开任务页或刷新将清空。', missingInputs:'开始前请填完所有输入。这里仅检查非空，不验证真实系统、文件或地址。', boundInputs:'本次模拟绑定的输入',
  taskActions: {start:'开始模拟',approve:'批准模拟步骤',cancel:'取消模拟',fail:'模拟失败',rollback:'模拟回滚',reset:'重置演示',finish:'模拟完成'},
  approvalTitle:'等待你的确认', approvalBody:'原因：演示驱动安装流程。范围：仅浏览器内存。命令：无。真实接入后必须展示具体命令、目标和权限。',
  risk:'风险：本次演示不修改系统。真实驱动安装需要单独授权。', rollbackInfo:'回滚性：这里只演示状态，不证明真实操作可回滚。',
  logTitle:'模拟事件日志', noEvents:'尚未开始演示',
  chatTitle:'AI 对话', chatIntro:'测试输入与会话布局；这里不是实际模型回复。',
  newChat:'清空演示会话', messageLabel:'演示消息', placeholder:'输入一条测试消息，不要输入密钥…', send:'发送演示',
  greeting:'你好，我是 Workbench 界面预览。真实 Hermes 会话将在接口确认后接入。', reply:'[演示回复] 已收到输入。此消息未发送给任何模型。', context:'执行上下文', contextBody:'后端未连接，没有活动工具或系统任务。',
  updateTitle:'更新中心', updateIntro:'内核和外壳分别管理版本、备份及回退。', check:'检查更新（未接入）',
  onboardingTitle:'初始化向导', onboardingIntro:'预览配置步骤。当前不会创建目录、检测磁盘或写入配置。', next:'下一步预览', back:'上一步', complete:'已到预览最后一步；尚未配置实例。',
  selected:'示例详情', scope:'当前页面展示固定示例，不读取 U 盘内容。',
};
export const serviceCopy={
 title:'本实例服务管理 · 实验',help:'仅在 Workbench 管理服务器提供的页面上可用；普通预览服务器没有管理接口。控制令牌不是模型 API Key。关闭浏览器不会停止服务。',
 token:'临时管理令牌',check:'读取服务状态',start:'启动本实例并连接',connect:'连接本实例',stop:'停止本实例',
 confirm:'我确认停止此管理器启动的服务，活动任务可能中断；已产生的修改不会自动撤销。',
 pending:'操作进行中，请勿关闭管理器',error:'操作失败或结果未知。请先读取服务状态；不会自动重试启动或停止。',
 states:{unknown:'尚未确认服务状态',idle:'本管理器没有运行实例',starting:'服务正在启动',ready:'服务已就绪',changing:'管理操作进行中',stopping:'服务正在停止',stopped:'服务已停止',exited:'服务已退出，请停止并清理本实例句柄后再启动'},
};
export const learnCopy={
 prepareTitle:'整理为可复用技能 · 实验',prepareHelp:'仅本工作台管理的服务可用。准备阶段只调用已核对版本的 Hermes 提示生成器，不调用模型、不读取所填来源、不写 Skill。未知生成器版本会拒绝；不会退回可能执行快捷命令的通用命令分发。',source:'学习来源（本会话、指定文件或说明）',scope:'允许读取和写入的范围及限制',prepare:'准备学习请求（尚不执行）',reviewTitle:'确认交给 Hermes 整理草稿',reviewHelp:'这是请求准备完成，不是 Skill 生成完成。确认后启动真实模型轮次，可能读取来源、调用工具并产生费用。要求 Hermes 在写文件前说明路径并征求确认；提示约束不等同于文件系统沙箱，仍需审核工具审批。产物只能视为未验证草稿。',fingerprint:'上游提示生成器指纹',prompt:'查看将发送的完整提示',confirm:'我确认来源与范围，允许在当前会话启动整理；不授予第三方安装、发布或执行所学流程的权限。',submit:'确认并发送学习请求',dismiss:'丢弃本次请求',
};
export const liveCopy={
 viewTranscript:'只读查看最近 50 条',transcriptHelp:'查看会将所选会话正文读取到当前页签内存；不恢复会话、不发送给模型。仅展示用户与助手纯文本，跳过工具、隐藏消息及非文本内容。压缩后的会话可能解析到新 ID。',transcriptLoading:'正在读取历史消息',hideTranscript:'关闭历史正文',transcriptTitle:'历史正文（只读快照）',noTranscript:'本页没有可显示的纯文本消息。',transcriptOmitted:'部分消息或过长正文未展示；此处不是完整导出。',transcriptRoles:{user:'用户',assistant:'助手'},
 tasks:'查看实际任务活动',navigationHelp:'在工作台内切换页面会保留连接与本页签会话。刷新、重连会清空本地显示；关闭浏览器不保证任务已停止，需要明确请求停止或停止本实例服务。',
 profiles:'服务配置列表（Profile）',profilesHelp:'点击后读取当前服务可枚举的配置名称、模型和技能数量，不读取会话正文、不切换配置。列表可能包含同一 Hermes 安装下的其他 Profile；断线后仅供参考。',loadProfiles:'读取配置列表',profilesLoading:'正在读取配置',noProfiles:'服务没有返回配置。',defaultProfile:'默认配置',profileModel:'模型',profileProvider:'提供方',profileSkills:'技能数量',notConfigured:'未配置',
 skills:'当前服务可用 Skills',skillsHelp:'只读缓存快照，受平台和禁用设置过滤；不是完整安装清单或已验证能力库。变更后可能需要重新启动服务；断线后仅供参考。',loadSkills:'读取可用 Skills',skillsLoading:'正在读取 Skills',noSkills:'服务未返回可用 Skills；不代表没有安装。',
 sessions:'已有会话索引',listSessions:'读取最近 50 条会话',listing:'正在读取',emptySessions:'没有可显示的会话',untitled:'未命名会话',messages:'条消息',sessionHelp:'仅在点击后读取当前服务的会话索引，不加载完整正文、不恢复执行。返回的预览片段不会保留或展示。上游恢复会话可能自动续跑，恢复入口仍在接入。',
 title:'真实连接实验',warning:'开发入口：只连接你主动指定的本机 Hermes。发送消息可能调用已配置模型及工具，产生费用或系统操作；不是模拟。当前尚未达到集中测试发布标准。',
 demo:'返回模拟聊天',connection:'本机服务连接',port:'本机端口',token:'临时服务令牌（不是模型 API Key）',connect:'连接并建立测试会话',disconnect:'断开测试会话',
 phases:{idle:'未连接',connecting:'等待服务握手',session:'正在建立会话',ready:'已连接 · 可以发送消息',closed:'连接已关闭',failed:'连接或会话失败'},
 error:'请求失败或结果未确认。请检查服务状态；不会自动重发消息。',approval:'服务正在等待审批',approvalHelp:'以下为服务提供的待执行命令与原因。批准仅针对本条请求，不授予会话或永久权限；批准后可能发生实际修改，停止不等于回滚。',approvalChoices:{once:'仅批准本次',deny:'拒绝本次'},
 uncertain:'连接已断开，运行结果未知；不能视为已取消。',truncated:'显示文本超过限制，已截断；不是完整执行记录。',message:'真实消息',placeholder:'输入测试消息；不要粘贴密钥…',send:'发送真实消息',stop:'请求停止本轮',stopping:'已请求停止，等待终态事件',
 turnStates:{streaming:'正在接收回复',complete:'本轮完成',failed:'本轮失败',interrupted:'本轮已中断'},
 tools:'本轮工具活动',toolStates:{running:'正在调用',finished:'调用已结束（不代表成功）',unknown:'结束状态未确认'},toolsTruncated:'仅显示前 100 条工具活动。',toolHelp:'只展示工具名称和生命周期；不自动展示可能包含敏感信息的参数、输出。',seconds:'秒',
};
export const navigation = [
  {path:'/capabilities',label:'我的能力',icon:'▦'},
  {path:'/',label:'工作台',icon:'⌂'}, {path:'/chat',label:'AI 对话',icon:'◇'}, {path:'/tools',label:'运维工具',icon:'⊞'},
  {path:'/tasks',label:'任务中心',icon:'≡'}, {path:'/knowledge',label:'知识库',icon:'▤'}, {path:'/skills',label:'Skills',icon:'☆'},
  {path:'/repository',label:'资源仓库',icon:'▣'}, {path:'/terminal',label:'终端入口',icon:'›_'}, {path:'/settings',label:'设置与更新',icon:'⚙'},
  {path:'/onboarding',label:'初始化向导',icon:'→'},
] as const;
export const catalogCopy={title:'实例 Skill 草稿目录',help:'只读取此实例 home 下的 skills 文件，按目录内容计算指纹，不执行 Skill。导出后可到能力卡片页导入；不包含脚本正文、验证记录或授权。禁用状态、平台和依赖可用性尚未核验；无 Skill、链接、冲突或超限时不导出。',export:'读取并导出未验证草稿'};
export const capabilityCopy={
 exportLabel:'导出本页草稿',exportHelp:'仅保存卡片定义，不包含本次输入参数、执行记录或验证证据。文件由浏览器下载；离页前请自行保存。',
 title:'我的能力',intro:'有验证依据的方法，才是可复用的能力。当前为开发入口，尚未连接实例能力库。',
 importTitle:'导入卡片草稿',importHelp:'只读取你选择的 JSON 文件（卡片数组，最大 64 KiB）；不上传、不安装 Skill、不导入验证状态。成功导入将替换本页草稿；离页或刷新会清空。不要填写密钥。',importLabel:'选择卡片 JSON',loading:'正在读取草稿',error:'导入或参数校验失败；未执行任务。',empty:'尚无能力卡片。不会用示例冒充已经验证的工作。',drafts:'本页草稿',draft:'草稿 · 未验证',method:'引用方法',fingerprint:'声明的内容指纹（尚未与实际 Skill 核对）',required:'（必填）',optional:'（可选）',review:'核对本次参数',reviewTitle:'本次参数预览',executionPending:'真实方法、依赖和环境核对尚未接入，当前不能执行或发布为已验证能力。',execute:'交给 Hermes 执行（待接入）',
};
export const taskCopy={
 title:'任务中心',help:'只展示当前工作台连接观察到的 Hermes 轮次与工具活动，不生成虚构步骤或进度。',chat:'返回真实聊天与审批',empty:'尚未观察到任务。请在真实聊天中连接服务并主动发送消息。',lifetime:'记录只保留在当前页签内存，切换页面保留，刷新或重新连接会清空；不是完整持久化任务库。',verification:'模型轮次完成不代表业务验证通过；工具调用结束不代表成功，停止也不撤销已发生的修改。',round:'会话轮次',session:'运行会话',noTools:'没有观察到工具事件，不推断工具是否执行。',demo:'打开模拟流程测试页',
 states:{running:'正在运行', 'waiting-approval':'等待审批',stopping:'已请求停止，等待终态',unknown:'连接中断，运行结果未知',complete:'模型轮次完成（业务结果未验证）',failed:'本轮失败',interrupted:'本轮已中断（不代表回滚）'},
};
export const statusLabels = {pending:'待执行',running:'执行中', 'waiting-approval':'待审批',succeeded:'已完成',failed:'失败',cancelled:'已取消','rolled-back':'已回滚'} as const;
export type TaskStatus = keyof typeof statusLabels;
export const workflows:readonly Workflow[] = [
 {id:'printer',version:'draft.1',name:'打印机部署（模拟）',description:'重新检查本机条件，不复用其他电脑的授权或 IP。',inputs:['目标电脑与系统版本','打印机地址','经审核的驱动包'],steps:[
  {id:'system',label:'检查系统与网络'}, {id:'driver',label:'匹配驱动与设备'},
  {id:'install',label:'安装驱动与队列',approval:'需确认目标设备、驱动来源、管理员权限及恢复方案。这里只模拟，不运行安装命令。'},
  {id:'verify',label:'验证打印结果'}]},
 {id:'archive',version:'draft.1',name:'文档归档（模拟）',description:'独立的文档步骤，不需要打印机或驱动检查。',inputs:['本次选择的文件范围','分类规则','目标知识库目录'],steps:[
  {id:'extract',label:'提取选定文件内容'}, {id:'classify',label:'生成分类与摘要'},
  {id:'write',label:'确认并写入知识库',approval:'需确认输出目录、文件清单及覆盖策略。这里只模拟，不读取或写入真实文件。'}]},
];
export const recentTasks: readonly {id:string;name:string;status:TaskStatus}[] = [
  {id:'DEMO-004',name:'打印机部署审批',status:'waiting-approval'}, {id:'DEMO-003',name:'网络诊断示例',status:'succeeded'},
  {id:'DEMO-002',name:'资源校验失败示例',status:'failed'},
];
export const shortcuts = [{title:'安装打印机',subtitle:'预览审批与任务流程',to:'/tasks/demo',icon:'▣'}, {title:'网络诊断',subtitle:'浏览运维工具',to:'/tools',icon:'⌁'}, {title:'开始对话',subtitle:'探索聊天布局',to:'/chat',icon:'◇'}, {title:'初始化环境',subtitle:'查看配置向导',to:'/onboarding',icon:'→'}];
export const telemetry = [{label:'Hermes 服务',value:'未连接'},{label:'便携目录',value:'待识别'},{label:'API 与模型',value:'待 P1 接入'},{label:'权限模式',value:'仅界面演示'}];
export const catalogs: Record<string,{title:string;description:string;items:readonly {name:string;detail:string;tag:string}[]}> = {
  skills:{title:'Skills 管理中心',description:'从草稿到审核，让可重复的流程可追溯。',items:[{name:'打印机部署',detail:'演示流程 · 待审核 · 不执行',tag:'草稿'},{name:'网络诊断',detail:'展示验证记录与适用范围',tag:'示例'},{name:'知识归档',detail:'Markdown 归档流程占位',tag:'草稿'}]},
  repository:{title:'本地资源仓库',description:'驱动、工具和离线制品的统一目录。',items:[{name:'打印机驱动包',detail:'未加载实际文件；哈希及签名待校验',tag:'驱动'},{name:'诊断工具包',detail:'下载与安装接口未接入',tag:'工具'},{name:'离线制品',detail:'不声称制品已存在或可信',tag:'离线包'}]},
  knowledge:{title:'知识库',description:'连接你的 Obsidian Vault，保留开放的 Markdown 文件。',items:[{name:'00-Inbox',detail:'收集待整理的操作记录',tag:'示例目录'},{name:'运行手册',detail:'经审核的故障排查说明',tag:'示例目录'}]},
  tools:{title:'运维工具',description:'每次系统变更都应有明确范围、审批和结果。',items:[{name:'打印机部署',detail:'在任务中心体验模拟流程',tag:'未接入'},{name:'网络检查',detail:'不扫描实际网络',tag:'未接入'},{name:'Windows 修复',detail:'不修改注册表或服务',tag:'未接入'}]},
  terminal:{title:'终端与备用入口',description:'保留上游工具入口，不通过解析终端文本获取核心状态。',items:['CLI','TUI','Web Dashboard','Desktop'].map(name=>({name,detail:'请继续使用 P0-Workbench；浏览器启动接口待接入',tag:'未接入'}))},
};
export const updates = [{name:'Hermes 内核',description:'沿用官方更新器；展示提交、回执和恢复点。'},{name:'Portable 外壳',description:'独立更新通道；校验整包，保留 Runtime 与用户数据。'}];
export const wizardSteps = ['选择便携目录','磁盘与权限检查','准备运行环境','API 与代理','知识库与资源','最终健康检查'];
