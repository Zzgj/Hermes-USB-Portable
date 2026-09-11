import {spawn} from 'node:child_process';
import {isAbsolute} from 'node:path';

// One owner, one child handle. Never attach to or terminate a PID read from disk.
// The caller supplies isolated environment and an authenticated protocol probe.
export function startOwnedProcess({executable,args=[],cwd,env,probe,startupMs=30_000,stopMs=5_000}) {
 if(!isAbsolute(executable)||!isAbsolute(cwd)||!Array.isArray(args)||args.some(x=>typeof x!=='string')||typeof probe!=='function'||!env||
 !Number.isInteger(startupMs)||startupMs<1||startupMs>120_000||!Number.isInteger(stopMs)||stopMs<1||stopMs>30_000)throw new Error('Invalid process options');
 // Keep stdin open as an ownership pipe. Windows job host exits on parent EOF.
 const child=spawn(executable,args,{cwd,env,stdio:['pipe','pipe','pipe'],shell:false,windowsHide:true});
 child.stdin.on('error',()=>{});
 let state='starting',buffer='',probing=false,terminal=false,settled=false,stopPromise;
 const healthAbort=new AbortController();
 let resolveReady,rejectReady,resolveExit;
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
 const exited=new Promise(resolve=>{resolveExit=resolve;});
 const reject=(code)=>{if(!settled){settled=true;rejectReady(new Error(code));}};
 const finish=(code,signal)=>{
  if(terminal)return;terminal=true;healthAbort.abort();clearTimeout(startup);state=state==='stopping'?'stopped':'exited';
  reject('PROCESS_EXITED_BEFORE_READY');resolveExit({code,signal});
 };
 const stop=()=>{
  if(stopPromise)return stopPromise;
  stopPromise=(async()=>{
   clearTimeout(startup);healthAbort.abort();reject('PROCESS_STOPPED_BEFORE_READY');
   if(terminal)return exited;
   state='stopping';child.kill('SIGTERM');
   const escalation=setTimeout(()=>{if(!terminal)child.kill('SIGKILL');},stopMs);
   try{return await exited;}finally{clearTimeout(escalation);}
  })();return stopPromise;
 };
 const fail=(code)=>{reject(code);void stop();};
 const startup=setTimeout(()=>fail('PROCESS_STARTUP_TIMEOUT'),startupMs);
 child.on('error',()=>{
  if(!child.pid){reject('PROCESS_SPAWN_FAILED');finish(null,null);}
  // A signal error is not proof that a running process exited.
  else reject('PROCESS_CONTROL_FAILED');
 });
 child.once('exit',finish);
 // Drain diagnostics but never retain raw output: it may contain secrets or user text.
 child.stderr.on('data',()=>{});
 child.stdout.on('data',chunk=>{
  if(terminal||state!=='starting'||probing)return;
  buffer+=chunk.toString('utf8');
  if(buffer.length>65536){fail('PROCESS_OUTPUT_LIMIT');return;}
  const lines=buffer.split('\n');buffer=lines.pop();
  for(const line of lines){
   const match=/^HERMES_(?:BACKEND|DASHBOARD)_READY port=(\d+)\r?$/.exec(line);
   if(!match)continue;
   const port=Number(match[1]);if(port<1||port>65535){fail('PROCESS_INVALID_PORT');return;}
   probing=true;
   Promise.resolve().then(()=>probe(port,healthAbort.signal)).then(ok=>{
    if(terminal||state!=='starting')return;
    if(ok!==true){fail('PROCESS_HEALTH_FAILED');return;}
    clearTimeout(startup);state='ready';settled=true;resolveReady({port});
   }).catch(()=>{if(!terminal&&state==='starting')fail('PROCESS_HEALTH_FAILED');});
   break;
  }
 });
 return {ready,exited,stop,get state(){return state;}};
}
