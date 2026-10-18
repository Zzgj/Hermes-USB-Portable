import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';

// Ordering evidence for the portable native composition only:
// acquireInstanceLock -> checkRecovery -> assertPortableEntryGuard -> adapter.prepare
// The barrier is a controlled builtin file-API hook installed in an isolated child
// process before the production modules are dynamically imported, so the recorded
// observations come from the real guard call and not from a re-implementation.

const repository=fileURLToPath(new URL('../../',import.meta.url));
const workbench=fileURLToPath(new URL('../',import.meta.url));
const coordination=['launch.bat','scripts/open-hermes.ps1','scripts/start-web-workbench.ps1','workbench/scripts/legacy-hermes-entry.mjs'];
const markerBytes='{"schema":1,"marker":"p2-guard-order-test"}';
const tamperBytes='tampered-launcher-bytes-from-p2-guard-order-test';
const foreignOwner='{"schema":1,"nonce":"foreign-lock-owner","pid":1,"created":"2026-01-01T00:00:00.000Z"}';

const CHILD=String.raw`
const cfg=JSON.parse(process.env.GUARD_ORDER_CONFIG);
const pathMod=await import('node:path');
const join=pathMod.join;
const fsMod=await import('node:fs');
const fsp=fsMod.promises;
const urlMod=await import('node:url');
const origRead=fsp.readFile.bind(fsp);
const origLstat=fsp.lstat.bind(fsp);
const origWrite=fsp.writeFile.bind(fsp);
const origMkdir=fsp.mkdir.bind(fsp);
const canonicalRoot=await fsp.realpath(cfg.root);
const canonicalHome=await fsp.realpath(cfg.home);
const lockDir=join(canonicalHome,'.p2-manager-lock');
const ownerPath=join(lockDir,'owner.json');
const dataPath=canonicalHome;
const coordPath=join(canonicalRoot,'launch.bat');
const markerPath=join(canonicalRoot,'logs','diagnostics','p2-install-active.json');
const out={scenario:cfg.scenario,events:[],guardReads:[],guardEntry:[],startError:null,statusAfterStart:null,statusAfterStop:null,lockDirAfterOutcome:null,reacquired:false,foreignOwner:null};
const state={phase:'setup',guardReads:0,entrySeen:0};
async function exists(p){
 try{const s=await origLstat(p);return {exists:true,directory:s.isDirectory(),file:s.isFile()};}
 catch(error){if(error.code==='ENOENT')return {exists:false};throw error;}
}
fsp.readFile=async function(path,...rest){
 const key=String(path);
 if(state.phase==='start'&&key===coordPath){
  state.guardReads+=1;
  const lock=await exists(lockDir),owner=await exists(ownerPath);
  let ownerText=null,ownerSchema=false;
  if(owner.exists){ownerText=await origRead(ownerPath,'utf8');try{ownerSchema=JSON.parse(ownerText).schema===1;}catch{ownerSchema=false;}}
  out.guardReads.push({n:state.guardReads,lockDir:lock.exists,owner:owner.exists,ownerSchema,
   prepareCalls:out.events.filter(event=>event==='prepare').length,
   startCalls:out.events.filter(event=>event==='start').length});
 }
 return origRead(path,...rest);
};
fsp.lstat=async function(path,...rest){
 const key=String(path);
 if(state.phase==='start'&&key===dataPath){
  state.entrySeen+=1;
  const lock=await exists(lockDir),owner=await exists(ownerPath);
  out.guardEntry.push({n:state.entrySeen,lockDir:lock.exists,owner:owner.exists,
   prepareCalls:out.events.filter(event=>event==='prepare').length});
  if(cfg.scenario==='marker'){
   await origMkdir(join(canonicalRoot,'logs','diagnostics'),{recursive:true});
   await origWrite(markerPath,cfg.markerBytes);
  }else if(cfg.scenario==='tamper'){
   await origWrite(coordPath,cfg.tamperBytes);
  }
 }
 return origLstat(path,...rest);
};
const entriesUrl=urlMod.pathToFileURL(join(cfg.workbench,'scripts','portable-native-entries.mjs')).href;
const lockUrl=urlMod.pathToFileURL(join(cfg.workbench,'scripts','instance-lock.mjs')).href;
const {createPortableNativeEntries}=await import(entriesUrl);
const {acquireInstanceLock}=await import(lockUrl);
// Explicit readiness barrier: harness, hooks and production imports are all in
// place before the parent arms any deadline.
console.log('READY');
if(cfg.scenario==='hang'){
 setInterval(()=>{},1000);
 await new Promise(()=>{});
}
let resolveClosed=null;
const makeAdapters=()=>({cli:{prepare:async()=>{
 out.events.push('prepare');
 return {start:()=>{
  out.events.push('start');
  const closed=new Promise(resolve=>{resolveClosed=resolve;});
  // No readiness signal: the harness reports running immediately, so the
  // observed status is deterministic instead of racing a microtask promotion.
  return {closed,stop:async()=>{
   out.events.push('stop');
   const result={treeExited:true};
   resolveClosed(result);
   return result;
  }};
 }};
}}});
if(cfg.scenario==='foreign'){
 await origMkdir(lockDir,{mode:0o700});
 await origWrite(ownerPath,cfg.foreignOwner,{flag:'wx'});
}
const manager=await createPortableNativeEntries({root:cfg.root,home:cfg.home},{makeAdapters});
state.phase='start';
try{
 out.statusAfterStart=await manager.start('cli');
}catch(error){
 out.startError=String(error&&error.message);
}
if(cfg.scenario==='normal'){
 out.lockDirAfterStart=(await exists(lockDir)).exists;
 out.statusAfterStop=await manager.stop();
}
out.lockDirAfterOutcome=(await exists(lockDir)).exists;
if(cfg.scenario==='foreign'){
 try{await origRead(ownerPath,'utf8').then(text=>{out.foreignOwner=text;});}catch{out.foreignOwner=null;}
 try{await acquireInstanceLock(canonicalHome);out.reacquired=true;}catch{}
}else{
 try{const next=await acquireInstanceLock(canonicalHome);out.reacquired=true;await next.release();}catch{}
}
console.log(JSON.stringify(out));
`;

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'portable-guard-order-'));
 // Cleanup is opt-out: when a child exit or stream drain is unconfirmed the
 // fixture is preserved. The same callback is exposed so a test can invoke it
 // and prove it really skips deletion.
 const guard={keep:false};
 const cleanup=()=>guard.keep?undefined:rm(root,{recursive:true,force:true});
 t.after(cleanup);
 const home=join(root,'data');
 await mkdir(home);
 for(const path of coordination){
  await mkdir(dirname(join(root,path)),{recursive:true});
  await writeFile(join(root,path),await readFile(join(repository,path)));
 }
 return {root:await realpath(root),home:await realpath(home),guard,cleanup};
}

function waitFor(promise,ms){
 return new Promise(resolve=>{
  const timer=setTimeout(()=>resolve(false),ms);
  promise.then(()=>{clearTimeout(timer);resolve(true);},()=>{clearTimeout(timer);resolve(false);});
 });
}

const exists=async path=>{try{await realpath(path);return true;}catch{return false;}};

// Controllable child double: lets a test drive `close` and stream `end`
// independently, which a real process cannot be made to do on demand.
class FakeChild extends EventEmitter{
 constructor(){
  super();
  this.pid=1234;
  this.stdout=new PassThrough();
  this.stderr=new PassThrough();
  this.killed=false;
 }
 kill(){this.killed=true;return true;}
 exit(code=0){this.stdout.end();this.stderr.end();this.emit('close',code,null);}
 closeWithoutDrain(code=0){this.emit('close',code,null);}
}

// Single-settlement driver shared by the real child and the controllable double.
// The deadline is armed only after readiness, and every termination path waits a
// bounded time for `close` and for both output streams before deciding whether the
// fixture may be deleted. Exit and drain are recorded separately.
function driveChild(child,{guard=null,timeoutMs=60000,readyTimeoutMs=60000,closeGraceMs=10000,streamGraceMs=5000}={}){
 return new Promise((resolve,reject)=>{
  let stdout='',stderr='',ready=false,settled=false,terminating=false,runtimeError=null;
  let spawned=child.pid!==undefined;
  let deadline=null,readiness=null;
  const ended=new Set();
  const streamsEnded=new Promise(done=>{
   for(const [name,stream] of [['out',child.stdout],['err',child.stderr]])stream.on('end',()=>{ended.add(name);if(ended.size===2)done(true);});
  });
  const closed=new Promise(done=>{child.on('close',(code,signal)=>done({code,signal}));});
  const completion=(childExited,streamsDrained)=>({childExited,streamsDrained,cleanupConfirmed:childExited===true&&streamsDrained===true});
  const complete=(fn,value,status)=>{
   if(settled)return;
   settled=true;
   if(deadline)clearTimeout(deadline);
   if(readiness)clearTimeout(readiness);
   if(guard&&!status.cleanupConfirmed)guard.keep=true;
   fn(value);
  };
  const fail=(code,status,extra={})=>complete(reject,Object.assign(new Error(code),{code,...status},extra),status);
  // Shared termination: kill, bounded wait for exit, bounded wait for drain, then
  // report exit and drain separately instead of collapsing them into one verdict.
  const terminate=async code=>{
   if(settled||terminating)return;
   terminating=true;
   if(deadline)clearTimeout(deadline);
   child.kill();
   const exited=await waitFor(closed,closeGraceMs);
   const drained=exited?await waitFor(streamsEnded,streamGraceMs):false;
   if(!exited||!drained){fail(code+'_CLEANUP_BLOCKED',completion(exited,drained));return;}
   fail(code,completion(true,true));
  };
  readiness=setTimeout(()=>{if(ready||settled)return;void terminate('CHILD_NOT_READY');},readyTimeoutMs);
  child.on('spawn',()=>{spawned=true;});
  child.on('error',error=>{
   if(settled)return;
   if(!spawned){
    const status=completion(true,true);
    complete(reject,Object.assign(new Error('CHILD_SPAWN_FAILED: '+error.message),{code:'CHILD_SPAWN_FAILED',...status,cause:error}),status);
    return;
   }
   // Post-spawn error: keep draining and settle on close so no pipe is abandoned.
   runtimeError=runtimeError||error;
  });
  child.stdout.on('data',chunk=>{
   stdout+=chunk;
   if(!ready&&/(?:^|\r?\n)READY\r?\n/.test(stdout)){
    ready=true;
    if(readiness)clearTimeout(readiness);
    if(!deadline)deadline=setTimeout(()=>{void terminate('CHILD_TIMEOUT');},timeoutMs);
   }
  });
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  child.on('close',async(code,signal)=>{
   if(settled||terminating)return;
   const drained=await waitFor(streamsEnded,streamGraceMs);
   if(!drained){fail('CHILD_CLEANUP_UNCONFIRMED',completion(true,false),{exitCode:code});return;}
   if(runtimeError){fail('CHILD_ERROR_RUNTIME',completion(true,true),{exitCode:code,cause:runtimeError});return;}
   if(!ready){fail('CHILD_FAILED_NO_READY',completion(true,true),{exitCode:code,stderr});return;}
   const line=stdout.trim().split(/\r?\n/).filter(Boolean).pop();
   if(code!==0||!line){fail('CHILD_FAILED',completion(true,true),{exitCode:code,stderr});return;}
   let parsed;
   try{parsed=JSON.parse(line);}
   catch(error){fail('CHILD_OUTPUT_INVALID',completion(true,true),{exitCode:code});return;}
   complete(resolve,parsed,completion(true,true));
  });
 });
}

function runChild(config,{guard=null,execPath=process.execPath,...rest}={}){
 const child=spawn(execPath,['--input-type=module','-e',CHILD],{
  env:{...process.env,GUARD_ORDER_CONFIG:JSON.stringify({...config,workbench})},
  stdio:['ignore','pipe','pipe'],windowsHide:true});
 return driveChild(child,{guard,...rest});
}

test('guard reads the coordinated launcher after the lock owner exists and exactly once',async t=>{
 const {root,home,guard}=await fixture(t);
 const seen=await runChild({root,home,scenario:'normal'},{guard});
 assert.equal(seen.guardReads.length,1);
 const hit=seen.guardReads[0];
 assert.equal(hit.lockDir,true);
 assert.equal(hit.owner,true);
 assert.equal(hit.ownerSchema,true);
 assert.equal(hit.prepareCalls,0);
 assert.equal(hit.startCalls,0);
 assert.equal(seen.guardEntry.length,1);
 assert.equal(seen.guardEntry[0].lockDir,true);
 assert.equal(seen.guardEntry[0].prepareCalls,0);
 assert.deepEqual(seen.events,['prepare','start','stop']);
 assert.equal(seen.startError,null);
 assert.deepEqual(seen.statusAfterStart,{kind:'cli',state:'running'});
 assert.equal(seen.lockDirAfterStart,true);
 assert.deepEqual(seen.statusAfterStop,{kind:null,state:'idle'});
 assert.equal(seen.lockDirAfterOutcome,false);
 assert.equal(seen.reacquired,true);
 assert.equal(guard.keep,false);
});

test('recovery marker created at the guard barrier rejects without adapter effects and keeps bytes',async t=>{
 const {root,home,guard}=await fixture(t);
 const seen=await runChild({root,home,scenario:'marker',markerBytes},{guard});
 assert.match(String(seen.startError),/INTERRUPTED_INSTALL_REQUIRES_RECOVERY/);
 assert.deepEqual(seen.events,[]);
 assert.equal(seen.guardReads.length,0);
 assert.equal(seen.guardEntry.length,1);
 assert.equal(seen.guardEntry[0].lockDir,true);
 assert.equal(seen.lockDirAfterOutcome,false);
 assert.equal(seen.reacquired,true);
 assert.equal(await readFile(join(root,'logs','diagnostics','p2-install-active.json'),'utf8'),markerBytes);
});

test('launcher tampered at the guard barrier rejects without adapter effects and keeps bytes',async t=>{
 const {root,home,guard}=await fixture(t);
 const seen=await runChild({root,home,scenario:'tamper',tamperBytes},{guard});
 assert.match(String(seen.startError),/ENTRY_COORDINATION_UNCONFIRMED/);
 assert.deepEqual(seen.events,[]);
 assert.equal(seen.guardReads.length,1);
 assert.equal(seen.guardReads[0].lockDir,true);
 assert.equal(seen.lockDirAfterOutcome,false);
 assert.equal(seen.reacquired,true);
 assert.equal(await readFile(join(root,'launch.bat'),'utf8'),tamperBytes);
});

test('pre-existing foreign lock rejects before guard and leaves owner bytes unchanged',async t=>{
 const {root,home,guard}=await fixture(t);
 const seen=await runChild({root,home,scenario:'foreign',foreignOwner},{guard});
 assert.match(String(seen.startError),/INSTANCE_LOCKED/);
 assert.deepEqual(seen.events,[]);
 assert.equal(seen.guardReads.length,0);
 assert.equal(seen.guardEntry.length,0);
 assert.equal(seen.foreignOwner,foreignOwner);
 assert.equal(seen.reacquired,false);
 assert.equal(await readFile(join(home,'.p2-manager-lock','owner.json'),'utf8'),foreignOwner);
});

test('real timeout after readiness exits the owned child before failing',async t=>{
 const {root,home,guard}=await fixture(t);
 let failure=null;
 try{await runChild({root,home,scenario:'hang'},{guard,timeoutMs:2000});}
 catch(error){failure=error;}
 assert.ok(failure,'a hung child must not be reported as success');
 assert.equal(failure.code,'CHILD_TIMEOUT');
 assert.equal(failure.childExited,true);
 assert.equal(failure.streamsDrained,true);
 assert.equal(failure.cleanupConfirmed,true);
 assert.equal(guard.keep,false);
});

test('spawn failure settles as spawn failure without waiting for a deadline',async t=>{
 const {root,home,guard}=await fixture(t);
 const missing=join(root,'missing-node-binary-'+process.pid+'.exe');
 let failure=null;
 try{await runChild({root,home,scenario:'spawn-failure'},{guard,execPath:missing,readyTimeoutMs:30000,timeoutMs:30000});}
 catch(error){failure=error;}
 assert.ok(failure,'a spawn failure must reject instead of hanging');
 assert.equal(failure.code,'CHILD_SPAWN_FAILED');
 assert.equal(failure.childExited,true);
 assert.equal(failure.cleanupConfirmed,true);
});

test('confirmed exit without drained streams keeps the root through the real cleanup callback',async t=>{
 const {root,home,guard,cleanup}=await fixture(t);
 const sentinel=join(root,'sentinel.txt');
 await writeFile(sentinel,'keep-me');
 const fake=new FakeChild();
 fake.kill=function(){this.killed=true;this.closeWithoutDrain(0);return true;};
 const promise=driveChild(fake,{guard,timeoutMs:100,readyTimeoutMs:30000,closeGraceMs:500,streamGraceMs:200});
 fake.stdout.write('READY\n');
 let failure=null;
 try{await promise;}catch(error){failure=error;}
 assert.ok(failure,'unconfirmed drain must not be a success');
 assert.equal(failure.code,'CHILD_TIMEOUT_CLEANUP_BLOCKED');
 assert.equal(failure.childExited,true);
 assert.equal(failure.streamsDrained,false);
 assert.equal(failure.cleanupConfirmed,false);
 assert.equal(guard.keep,true);
 // The callback registered with the runner is what executes: it must skip deletion.
 await cleanup();
 assert.equal(await exists(root),true);
 assert.equal(await readFile(sentinel,'utf8'),'keep-me');
 await rm(root,{recursive:true,force:true});
});

test('unconfirmed child exit keeps the root through the real cleanup callback',async t=>{
 const {root,home,guard,cleanup}=await fixture(t);
 const sentinel=join(root,'sentinel.txt');
 await writeFile(sentinel,'keep-me');
 const fake=new FakeChild();
 fake.kill=function(){this.killed=true;return true;};
 const promise=driveChild(fake,{guard,timeoutMs:100,readyTimeoutMs:30000,closeGraceMs:200,streamGraceMs:200});
 fake.stdout.write('READY\n');
 let failure=null;
 try{await promise;}catch(error){failure=error;}
 assert.ok(failure,'an unconfirmed exit must not be a success');
 assert.equal(failure.code,'CHILD_TIMEOUT_CLEANUP_BLOCKED');
 assert.equal(failure.childExited,false);
 assert.equal(failure.streamsDrained,false);
 assert.equal(failure.cleanupConfirmed,false);
 assert.equal(guard.keep,true);
 await cleanup();
 assert.equal(await exists(root),true);
 assert.equal(await readFile(sentinel,'utf8'),'keep-me');
 await rm(root,{recursive:true,force:true});
});

test('readiness timeout terminates and waits for exit before failing',async t=>{
 const {root,home,guard,cleanup}=await fixture(t);
 const fake=new FakeChild();
 fake.kill=function(){this.killed=true;setImmediate(()=>this.exit(0));return true;};
 let failure=null;
 try{await driveChild(fake,{guard,readyTimeoutMs:100,closeGraceMs:1000,streamGraceMs:1000});}
 catch(error){failure=error;}
 assert.ok(failure,'a child that never signals readiness must fail');
 assert.equal(fake.killed,true);
 assert.equal(failure.code,'CHILD_NOT_READY');
 // Only the close path can have set these: the readiness branch waited for exit.
 assert.equal(failure.childExited,true);
 assert.equal(failure.streamsDrained,true);
 assert.equal(failure.cleanupConfirmed,true);
 assert.equal(guard.keep,false);
 await cleanup();
 assert.equal(await exists(root),false);
});
