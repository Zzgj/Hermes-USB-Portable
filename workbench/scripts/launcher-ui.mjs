// Presentation only: never display a manager token or a URL containing one.
export function formatLauncherBanner({origin,commit,baselineStatus},{color=false}={}){
 if(!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(origin)||!/^[a-f0-9]{40}$/.test(commit))throw new Error('INVALID_LAUNCHER_DISPLAY');
 const paint=(code,text)=>color?`\x1b[${code}m${text}\x1b[0m`:text;
 const rule=paint('36','  ────────────────────────────────────────────────────────────');
 return [
  '',rule,
  paint('1;96','  HERMES PORTABLE  /  P2 浏览器工作台'),
  paint('33','  P2-S1 开发测试版 · 非正式发布'),rule,'',
  paint('1;37','  运行状态'),
  `    管理服务    ${paint('32','已就绪，仅本机访问')}`,
  `    Hermes      ${paint('33','尚未启动，请在浏览器中启动并连接实例')}`,
  `    本机地址    ${origin}`,
  `    内核提交    ${commit.slice(0,12)}`,
  `    基线状态    ${baselineStatus==='known-baseline-partial'?'已识别，仍有未验收项目':'此内核版本尚未完成兼容验收'}`,'',
  paint('1;37','  控制菜单'),
  `    ${paint('30;46',' [1] 打开工作台 ')}  默认浏览器中打开 / 重新打开`,
  `    ${paint('36',' [0] 停止并退出 ')}  停止本管理服务及其持有的实例`,'',
  paint('33','  关闭浏览器不会停止服务，请保留此控制台。'),
  paint('33','  拔盘前必须确认服务停止；其他独立服务需分别停止。'),
  rule,
  '  输入 1 / 打开 / OPEN，或 0 / 退出 / EXIT，然后按回车。','',
 ].join('\n');
}
export function launcherCommand(value){
 const command=value.trim().toUpperCase();
 if(['1','打开','OPEN'].includes(command))return 'open';
 if(['0','退出','EXIT'].includes(command))return 'exit';
 return 'unknown';
}
