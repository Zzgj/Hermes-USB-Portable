import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createInterface} from 'node:readline';
import {portableWindowsOptions} from './portable-layout.mjs';
import {createNativeEntryManager} from './native-entry-manager.mjs';
import {createNativeEntryAdapters} from './native-entry-adapters.mjs';
import {startNativeOwnedProcess} from './native-owned-process.mjs';
import {assertPortableEntryGuard} from './portable-entry-guard.mjs';
import {openLocalBrowser} from './open-local-browser.mjs';

// Local launcher arguments only, NEVER exposed through control-server HTTP.
// Daemon/service commands cannot transfer ownership beyond this foreground tree.
export function legacyCommand(args){
 if(!Array.isArray(args)||args.some(value=>typeof value!=='string'||value.includes('\0'))||
  args.some(value=>/^(-p(?:.|$)|--profile(?:=|$)|--tui(?:=|$)|--worktree(?:=|$)|-w$)/.test(value)))throw new Error('LEGACY_COMMAND_UNSUPPORTED');
 if(!args.length)return ['-m','hermes_cli.main','--cli'];
 if(args[0]==='gateway'){
  if(args.length===1||(args.length===2&&args[1]==='run'))return ['-m','hermes_cli.main','gateway','run'];
  throw new Error('LEGACY_COMMAND_UNSUPPORTED');
 }
 // Maintenance that replaces this runtime and detached services stay outside
 // this entry controller; they require a separately stopped-instance workflow.
 if(!['--cli','chat','setup','model','config','doctor','status','sessions','tools','skills'].includes(args[0]))throw new Error('LEGACY_COMMAND_UNSUPPORTED');
 return ['-m','hermes_cli.main',...args];
}

export async function runLockedLegacyEntry({home,prepare,observe=()=>{}}){
 let child,result,readyFailed=false;
 const manager=await createNativeEntryManager({home,adapters:{cli:{prepare:async value=>{
  const prepared=await prepare(value);
  return {start:async()=>{
   child=await prepared.start();
   void child.ready?.catch(()=>{readyFailed=true;});
   void child.closed.then(value=>{result=value;},()=>{});
   observe(child);
   return child;
  }};
 }}}});
 await manager.start('cli');
 await manager.closed;
 if(manager.status().state!=='idle'||result?.treeExited!==true)throw new Error('LEGACY_EXIT_UNCONFIRMED');
 if(!Number.isInteger(result.exitCode)||result.exitCode<0||result.exitCode>0xffffffff)throw new Error('LEGACY_EXIT_CODE_UNAVAILABLE');
 return readyFailed&&result.exitCode===0?1:result.exitCode;
}

export async function launchLegacy(args){
 if(args[0]!=='--root'||!args[1]||args[2]!=='--')throw new Error('INVALID_LEGACY_ARGUMENTS');
 const root=resolve(args[1]),command=args.slice(3);
 const dashboard=command[0]==='dashboard';
 if(dashboard&&!(command.length===1||(command.length===3&&command[1]==='--host'&&command[2]==='127.0.0.1')))throw new Error('LEGACY_COMMAND_UNSUPPORTED');
 const hermesArgs=dashboard?null:legacyCommand(command);
 const options=await portableWindowsOptions(root,process.env);
 const git=join(root,'.cache','runtimes','windows-x64','git','cmd','git.exe');
 const adapters=createNativeEntryAdapters({...options,git,openBrowser:openLocalBrowser});
 let input,stop,stopping=false;
 const requestStop=()=>{
  if(!stop||stopping)return;
  stopping=true;
  void stop().catch(()=>{console.error('停止尚未确认，请保留窗口和实例锁，输入 STOP 重试；不要拔盘。');}).finally(()=>{stopping=false;});
 };
 try{
  return await runLockedLegacyEntry({home:options.home,prepare:async({home})=>{
   await assertPortableEntryGuard(root,home);
   if(dashboard)return adapters.dashboard.prepare({home});
   // Share the fixed-source/layout/env admission checks without launching the
   // fixed CLI command; the local launcher then supplies its allowed subcommand.
   await adapters.cli.prepare({home});
   return {start:()=>startNativeOwnedProcess({kind:'cli',python:options.python,args:hermesArgs,cwd:options.source,
    environment:{...options.environment,HERMES_HOME:home,PYTHONUNBUFFERED:'1'}})};
  },observe:child=>{
   stop=child.stop;
   console.log('此控制器持有当前实例锁。交互在独立控制台中进行；输入 STOP 停止本次进程树。');
   input=createInterface({input:process.stdin,output:process.stdout});
   input.on('line',line=>{if(line.trim().toUpperCase()==='STOP')requestStop();});
   input.on('close',requestStop);
   process.on('SIGINT',requestStop);process.on('SIGTERM',requestStop);
   if(dashboard)void child.ready.then(()=>child.open()).catch(()=>console.error('原生 Dashboard 尚未就绪或打开失败；未自动重试，输入 STOP 可停止。'));
  }});
 }finally{
  stop=null;input?.close();process.removeListener('SIGINT',requestStop);process.removeListener('SIGTERM',requestStop);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 launchLegacy(process.argv.slice(2)).then(code=>{process.exitCode=code<=255?code:1;},error=>{
  const unsupported=error?.message==='LEGACY_COMMAND_UNSUPPORTED';
  console.error(unsupported?'此受控入口不支持后台服务、跨 Profile 或运行环境更新命令；请先正常停止实例，再使用独立维护流程。':'入口未能安全启动或退出。请检查实例锁、恢复标记、便携路径和入口版本；未清锁、安装或重试。');
  process.exitCode=1;
 });
}
