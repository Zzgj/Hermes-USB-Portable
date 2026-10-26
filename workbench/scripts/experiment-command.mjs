import {spawn} from 'node:child_process';
import {mkdtemp,readFile,lstat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNativeProcessProtocol} from './native-process-protocol.mjs';

const error=(reason,treeExited=false)=>Object.assign(new Error(reason),{treeExited});
const outputLimit=16*1024*1024;

// Only the private supervisor can confirm teardown. Worker receipts and direct
// child exit alone cannot authorize another command, cleanup, or ready.flag.
export async function executeExperimentCommand(file,args,{python,cwd,env,timeoutMs=30*60*1000,stopMs=15_000}={},
 {platform=process.platform,spawnHost=spawn,scratch=tmpdir()}={}){
 if(platform!=='win32')throw error('WINDOWS_REQUIRED',true);
 if(![file,python,cwd,scratch].every(p=>typeof p==='string'&&isAbsolute(p)&&!p.includes('\0'))||
  !Array.isArray(args)||args.some(a=>typeof a!=='string'||a.includes('\0'))||!env||typeof env!=='object'||
  !Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30*60*1000||
  !Number.isInteger(stopMs)||stopMs<1||stopMs>30_000)throw error('EXPERIMENT_COMMAND_ARGUMENTS',true);
 const directory=await mkdtemp(join(scratch,'experiment-command-'));
 let treeExited=false;
 try{
  const completion=await new Promise((resolve,reject)=>{
   let host;
   try{
    // -I ignores PYTHONDONTWRITEBYTECODE: use explicit -B for both Python
    // layers so imports cannot add unmanifested cache files to the package.
    host=spawnHost(python,['-I','-B',fileURLToPath(new URL('./native-entry-host.py',import.meta.url)),'dashboard','--',
     '-I','-B',fileURLToPath(new URL('./experiment-command-worker.py',import.meta.url)),directory,String(outputLimit),'--',file,...args],
    {cwd,env:{...env},shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
   }catch{treeExited=true;reject(error('EXPERIMENT_COMMAND_SPAWN_FAILED',true));return;}
   let reason,grace,ended=false,settled=false,transportFailed=false,started=false,workerExit;
   const finish=(value,failure)=>{
    if(settled)return;settled=true;clearTimeout(deadline);clearTimeout(grace);
    if(failure)reject(failure);else resolve(value);
   };
   const stop=code=>{
    reason??=code;
    if(ended||grace)return;
    // EOF asks the existing outside owner to terminate its Job and drain pipes.
    // Never send business input or kill a discovered PID.
    grace=setTimeout(()=>{
     try{host.kill();}catch{} // exact owned host; kill-on-close is containment, not proof
     finish(null,error('EXPERIMENT_COMMAND_TREE_UNCONFIRMED'));
    },stopMs);
    try{host.stdin.end();}catch{transportFailed=true;}
   };
   const protocol=createNativeProcessProtocol(event=>{
    if(event.event==='started')started=true;
    else if(event.event==='closed')workerExit=event.exitCode;
    else stop('EXPERIMENT_COMMAND_PROTOCOL'); // worker emits no Dashboard port
   });
   const deadline=setTimeout(()=>stop('EXPERIMENT_COMMAND_TIMEOUT'),timeoutMs);
   host.stdin.on('error',()=>{transportFailed=true;stop('EXPERIMENT_COMMAND_TRANSPORT');});
   host.stdout.on('data',chunk=>{try{protocol.push(chunk);}catch{transportFailed=true;stop('EXPERIMENT_COMMAND_PROTOCOL');}});
   host.stdout.on('error',()=>{transportFailed=true;stop('EXPERIMENT_COMMAND_TRANSPORT');});
   host.stderr.on('data',()=>{}); // never echo command/host stderr or raw paths
   host.stderr.on('error',()=>{transportFailed=true;stop('EXPERIMENT_COMMAND_TRANSPORT');});
   host.once('error',()=>{transportFailed=true;stop('EXPERIMENT_COMMAND_SPAWN_FAILED');});
   host.once('close',code=>{
    ended=true;
    // A later close after the grace deadline cannot retroactively authorize reuse.
    if(settled)return;
    treeExited=!transportFailed&&started&&protocol.finish(code);
    if(!treeExited){finish(null,error('EXPERIMENT_COMMAND_TREE_UNCONFIRMED'));return;}
    if(reason||workerExit!==0){finish(null,error(reason??'EXPERIMENT_COMMAND_WORKER_FAILED',true));return;}
    finish({treeExited:true});
   });
  });
  if(!completion.treeExited)throw error('EXPERIMENT_COMMAND_TREE_UNCONFIRMED');
  const receiptPath=join(directory,'result.json'),outputPath=join(directory,'stdout.bin');
  for(const [path,limit] of [[receiptPath,1024],[outputPath,outputLimit]]){
   const info=await lstat(path);
   if(!info.isFile()||info.isSymbolicLink()||info.size>limit)throw error('EXPERIMENT_COMMAND_RECEIPT',true);
  }
  const receipt=JSON.parse(await readFile(receiptPath,'utf8'));
  if(!receipt||Object.keys(receipt).sort().join(',')!=='bytes,exitCode,schema'||receipt.schema!==1||
   !Number.isSafeInteger(receipt.bytes)||receipt.bytes<0||receipt.bytes>outputLimit||
   !Number.isInteger(receipt.exitCode)||receipt.exitCode<0||receipt.exitCode>0xffffffff)throw error('EXPERIMENT_COMMAND_RECEIPT',true);
  if(receipt.exitCode!==0)throw error('EXPERIMENT_COMMAND_FAILED',true);
  const bytes=await readFile(outputPath);
  if(bytes.length!==receipt.bytes)throw error('EXPERIMENT_COMMAND_RECEIPT',true);
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 }catch(cause){
  // Preserve only fixed categories; neither raw tool output nor paths escape.
  if(cause instanceof Error&&/^EXPERIMENT_COMMAND_[A-Z_]+$/.test(cause.message))throw cause;
  throw error('EXPERIMENT_COMMAND_RECEIPT',treeExited);
 }finally{
  // Unknown teardown retains all evidence. No automatic deletion/retry/reuse.
  if(treeExited){
   try{await rm(directory,{recursive:true,force:true});}
   catch{throw error('EXPERIMENT_COMMAND_CLEANUP_FAILED',true);}
  }
 }
}
