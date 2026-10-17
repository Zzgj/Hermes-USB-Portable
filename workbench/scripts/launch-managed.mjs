import {parseArgs} from 'node:util';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join,isAbsolute,dirname} from 'node:path';
import {stat} from 'node:fs/promises';

import {createInterface} from 'node:readline';
import {portableWindowsOptions} from './portable-layout.mjs';
import {inspectBaseline} from './check-hermes-baseline.mjs';
import {startControlServer} from './control-server.mjs';
import {startHermesInstance} from './hermes-instance.mjs';
import {prepareLearn} from './prepare-learn.mjs';
import {readSkillCatalog} from './skill-catalog.mjs';
import {prepareCapability} from './prepare-capability.mjs';
import {detectEntries as defaultDetectEntries} from './entry-detect.mjs';
import {formatLauncherBanner,launcherCommand} from './launcher-ui.mjs';
import {createPortableNativeEntries} from './portable-native-entries.mjs';
import {assertPortableEntryGuard} from './portable-entry-guard.mjs';
import {openLocalBrowser} from './open-local-browser.mjs';

export function parseLaunchArgs(args){
 const {values}=parseArgs({args,options:{root:{type:'string'},python:{type:'string'},source:{type:'string'},home:{type:'string'},git:{type:'string'},experimental:{type:'boolean'}}});
 if(!values.experimental)throw new Error('EXPERIMENTAL_OPT_IN_REQUIRED');
 if(values.root){if(values.python||values.source||values.home||values.git||!isAbsolute(values.root))throw new Error('INVALID_ROOT_OPTIONS');}
 else if(![values.python,values.source,values.home,values.git].every(value=>typeof value==='string'&&isAbsolute(value)))throw new Error('EXPLICIT_PATHS_REQUIRED');
 return values;
}
export async function launch(args){
 const values=parseLaunchArgs(args);
 const options=values.root?await portableWindowsOptions(values.root,process.env):{
  python:values.python,source:values.source,home:values.home,
  environment:{PATH:[dirname(values.python),dirname(process.execPath),'/usr/bin','/bin'].join(':'),PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1',TERMINAL_CWD:values.source},
 };
 if(!values.root&&process.platform==='win32')throw new Error('USE_PORTABLE_ROOT_ON_WINDOWS');
 const assets=values.root?join(values.root,'workbench','dist'):fileURLToPath(new URL('../dist',import.meta.url));
 if(!(await stat(join(assets,'index.html'))).isFile())throw new Error('BUILD_REQUIRED');
 const git=values.root?join(values.root,'.cache','runtimes','windows-x64','git','cmd','git.exe'):values.git;
 const baseline=inspectBaseline(options.source,git);
 if(baseline.tracked_changes)throw new Error('SOURCE_REVIEW_REQUIRED');
 console.log('正在检查 P2 开发测试基线，准备本机管理服务…');
 const nativeEntries=values.root?await createPortableNativeEntries({...options,root:values.root,git,openBrowser:openLocalBrowser}):undefined;
 const checkEntryGuard=values.root?()=>assertPortableEntryGuard(values.root,options.home):undefined;
 const control=await startControlServer({assets,startInstance:()=>startHermesInstance({...options,checkEntryGuard}),nativeEntries,prepareLearn:request=>prepareLearn(options,request),readCatalog:()=>readSkillCatalog(options.home),prepareCapability:request=>prepareCapability(options.home,request),detectEntries:()=>defaultDetectEntries({source:options.source,home:options.home,assetsDir:assets}),source:options.source,home:options.home});
 console.log(formatLauncherBanner({origin:control.origin,commit:baseline.commit,baselineStatus:baseline.status},{color:Boolean(process.stdout.isTTY)&&process.env.NO_COLOR===undefined}));
 const input=createInterface({input:process.stdin,output:process.stdout});let stopping=false;
 const shutdown=async()=>{
  if(stopping)return;stopping=true;
  try{
   await control.close();input.close();console.log('P2 管理服务及其持有的实例已停止。其他独立服务需分别确认停止后再拔盘。');
   process.removeListener('SIGINT',shutdown);process.removeListener('SIGTERM',shutdown);
  }catch{
   stopping=false;
   console.error('停止尚未确认，请勿拔出 U 盘。输入 0 或 EXIT 重试；必要时检查该实例的进程与日志。');process.exitCode=1;
  }
 };
 const open=()=>openLocalBrowser(`${control.origin}/#/chat/live?control=${control.token}`).catch(()=>console.error('无法自动打开浏览器。输入 1 或 OPEN 重试，输入 0 或 EXIT 停止服务。'));
 process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
 input.on('line',line=>{const command=launcherCommand(line);if(command==='exit')void shutdown();else if(command==='open'&&!stopping)void open();else if(!stopping)console.log('请输入 1 打开工作台，或输入 0 停止并退出，然后按回车。');});
 input.on('close',()=>{if(!stopping)void shutdown();});
 await open();
 return {shutdown};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 launch(process.argv.slice(2)).catch(()=>{console.error('P2 启动失败。请检查便携路径、源码状态、运行环境迁移及工作台构建；未尝试自动修复。');process.exitCode=1;});
}
