import {parseArgs} from 'node:util';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join,isAbsolute,dirname} from 'node:path';
import {stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {portableWindowsOptions} from './portable-layout.mjs';
import {inspectBaseline} from './check-hermes-baseline.mjs';
import {startControlServer} from './control-server.mjs';
import {startHermesInstance} from './hermes-instance.mjs';
import {prepareLearn} from './prepare-learn.mjs';
import {readSkillCatalog} from './skill-catalog.mjs';

export function parseLaunchArgs(args){
 const {values}=parseArgs({args,options:{root:{type:'string'},python:{type:'string'},source:{type:'string'},home:{type:'string'},git:{type:'string'},experimental:{type:'boolean'}}});
 if(!values.experimental)throw new Error('EXPERIMENTAL_OPT_IN_REQUIRED');
 if(values.root){if(values.python||values.source||values.home||values.git||!isAbsolute(values.root))throw new Error('INVALID_ROOT_OPTIONS');}
 else if(![values.python,values.source,values.home,values.git].every(value=>typeof value==='string'&&isAbsolute(value)))throw new Error('EXPLICIT_PATHS_REQUIRED');
 return values;
}
function openBrowser(url){
 const command=process.platform==='win32'?join(process.env.SystemRoot,'System32','rundll32.exe'):process.platform==='darwin'?'/usr/bin/open':'xdg-open';
 const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];
 return new Promise((resolveOpen,reject)=>{
  const child=spawn(command,args,{stdio:'ignore',shell:false,windowsHide:true});
  child.once('error',()=>reject(new Error('BROWSER_OPEN_FAILED')));
  child.once('exit',code=>code===0?resolveOpen():reject(new Error('BROWSER_OPEN_FAILED')));
 });
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
 const baseline=inspectBaseline(options.source,values.root?join(values.root,'.cache','runtimes','windows-x64','git','cmd','git.exe'):values.git);
 if(baseline.tracked_changes)throw new Error('SOURCE_REVIEW_REQUIRED');
 console.log(`P2 experimental source: ${baseline.commit} (${baseline.status}; not release-qualified)`);
 const control=await startControlServer({assets,startInstance:()=>startHermesInstance(options),prepareLearn:request=>prepareLearn(options,request),readCatalog:()=>readSkillCatalog(options.home)});
 console.log(`P2 manager: ${control.origin} (backend not started)`);
 console.log('Use the browser controls to start/stop. Type OPEN to reopen, or EXIT to stop this manager and its instance.');
 const input=createInterface({input:process.stdin,output:process.stdout});let stopping=false;
 const shutdown=async()=>{
  if(stopping)return;stopping=true;input.close();
  try{await control.close();console.log('P2 manager stopped.');}catch{console.error('P2 stop not confirmed. Inspect this instance before removing the drive.');process.exitCode=1;}
  process.removeListener('SIGINT',shutdown);process.removeListener('SIGTERM',shutdown);
 };
 const open=()=>openBrowser(`${control.origin}/#/chat/live?control=${control.token}`).catch(()=>console.error('Browser could not open. Type OPEN to retry or EXIT to stop.'));
 process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
 input.on('line',line=>{if(line.trim()==='EXIT')void shutdown();else if(line.trim()==='OPEN'&&!stopping)void open();});
 input.on('close',()=>{if(!stopping)void shutdown();});
 await open();
 return {shutdown};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 launch(process.argv.slice(2)).catch(()=>{console.error('P2 manager startup failed. Verify explicit paths, source state, runtime relocation and build. No automatic repair was attempted.');process.exitCode=1;});
}
