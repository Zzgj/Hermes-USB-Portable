import {spawn} from 'node:child_process';
import {isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNativeProcessProtocol} from './native-process-protocol.mjs';

// Private transport for the fixed Windows CLI/Dashboard adapters. No HTTP input.
export function startNativeOwnedProcess({kind,python,args,cwd,environment,probe,startupMs=60_000,stopMs=15_000},{platform=process.platform,spawnHost=spawn}={}){
 if(platform!=='win32')throw new Error('WINDOWS_REQUIRED');
 if(!['cli','dashboard'].includes(kind)||![python,cwd].every(p=>typeof p==='string'&&isAbsolute(p))||
  !Array.isArray(args)||!args.length||args.some(a=>typeof a!=='string'||a.includes('\0'))||!environment||
  (kind==='dashboard'&&typeof probe!=='function')||!Number.isInteger(startupMs)||startupMs<1||startupMs>120_000||
  !Number.isInteger(stopMs)||stopMs<1||stopMs>30_000)throw new Error('INVALID_NATIVE_PROCESS_OPTIONS');
 const host=spawnHost(python,[fileURLToPath(new URL('./native-entry-host.py',import.meta.url)),kind,'--',...args],{
  cwd,env:{...environment},shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],
 });
 let ended=false,stopping=false,settled=false,probing=false,stopPromise,exitCode,readyAccepted=false,treeExited=false,transportFailed=false;
 let resolveReady,rejectReady,resolveClosed;
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
 const closed=new Promise(resolve=>{resolveClosed=resolve;});
 void ready.catch(()=>{});
 const abort=new AbortController();
 const reject=reason=>{if(!settled){settled=true;rejectReady(new Error(reason));}};
 const requestStop=()=>{
  stopping=true;abort.abort();clearTimeout(startup);
  reject('NATIVE_PROCESS_STOPPED_BEFORE_READY');
  if(!ended)host.stdin.end();
 };
 const fail=reason=>{reject(reason);requestStop();};
 const accept=value=>{
  if(ended||stopping||settled)return;
  settled=true;readyAccepted=true;clearTimeout(startup);resolveReady(value);
 };
 const protocol=createNativeProcessProtocol(event=>{
  if(event.event==='closed')exitCode=event.exitCode;
  if(event.event==='failed')fail('NATIVE_PROCESS_FAILED');
  else if(event.event==='started'&&kind==='cli')accept({});
  else if(event.event==='port'&&kind==='dashboard'&&!probing&&!stopping){
   probing=true;
   Promise.resolve().then(()=>probe(event.port,abort.signal)).then(ok=>{
    if(ended||stopping)return;
    if(ok!==true)fail('NATIVE_PROCESS_HEALTH_FAILED');
    else accept({port:event.port});
   },()=>{if(!ended&&!stopping)fail('NATIVE_PROCESS_HEALTH_FAILED');});
  }
 });
 const startup=setTimeout(()=>fail('NATIVE_PROCESS_STARTUP_TIMEOUT'),startupMs);
 host.stdin.on('error',()=>{});
 host.stderr.on('data',()=>{});
 host.stdout.on('data',chunk=>{try{protocol.push(chunk);}catch{fail('NATIVE_PROCESS_PROTOCOL');}});
 host.stdout.on('error',()=>{transportFailed=true;fail('NATIVE_PROCESS_PROTOCOL');});
 host.once('error',()=>{transportFailed=true;fail('PROCESS_SPAWN_FAILED');});
 host.once('close',code=>{
  ended=true;abort.abort();clearTimeout(startup);reject('NATIVE_PROCESS_EXITED_BEFORE_READY');
  treeExited=!transportFailed&&protocol.finish(code);resolveClosed({treeExited,exitCode});
 });
 const stop=()=>{
  if(stopPromise)return stopPromise;
  stopPromise=(async()=>{
   requestStop();let timer;
   try{
    const result=await Promise.race([closed,new Promise((_,rejectStop)=>{
     timer=setTimeout(()=>rejectStop(new Error('NATIVE_PROCESS_STOP_UNCONFIRMED')),stopMs);
    })]);
    if(result.treeExited!==true)throw new Error('NATIVE_PROCESS_STOP_UNCONFIRMED');
    return result;
   }finally{clearTimeout(timer);}
  })();
  // A timeout is not an exit. Retain the handle/lock; permit an explicit recheck.
  void stopPromise.catch(()=>{stopPromise=null;});
  return stopPromise;
 };
 return {ready,closed,stop,get state(){return ended?(treeExited?'exited':'unknown'):stopping?'stopping':readyAccepted?'ready':'starting';}};
}
