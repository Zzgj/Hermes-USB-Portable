import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';

// Guard ordering for the two remaining production callers:
//   managed: launch-managed -> startHermesInstance -> startManagedInstance -> beforeStart(guard)
//   legacy : launchLegacy -> runLockedLegacyEntry -> createNativeEntryManager -> guard
// Observation happens at a controlled barrier installed in an isolated child
// process before the production modules are dynamically imported, so the lock
// state recorded is the state the real guard call sees. Net effect: no business
// process is ever created; any child-process API call throws immediately.

const repository=fileURLToPath(new URL('../../',import.meta.url));
const workbench=fileURLToPath(new URL('../',import.meta.url));
const coordination=['launch.bat','scripts/open-hermes.ps1','scripts/start-web-workbench.ps1','workbench/scripts/legacy-hermes-entry.mjs'];
const tamperBytes='tampered-launcher-bytes-from-callers-guard-order-test';
const restoreBytes='{"schema":1,"restore":"callers-guard-order-test"}';
const foreignOwner='{"schema":1,"nonce":"foreign-lock-owner","pid":1,"created":"2026-01-01T00:00:00.000Z"}';

const CHILD=String.raw`
const cfg=JSON.parse(process.env.CALLER_GUARD_CONFIG);
const pathMod=await import('node:path');
const join=pathMod.join;
const moduleMod=await import('node:module');
const require=moduleMod.createRequire(import.meta.url);
const urlMod=await import('node:url');
const fsp=require('node:fs').promises;
const cp=require('node:child_process');
const origRead=fsp.readFile.bind(fsp);
const origLstat=fsp.lstat.bind(fsp);
const origWrite=fsp.writeFile.bind(fsp);
const origMkdir=fsp.mkdir.bind(fsp);
let spawnCalls=0;
const spawnNames=['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'];
for(const name of spawnNames){if(typeof cp[name]==='function')cp[name]=function(){spawnCalls+=1;throw new Error('PROCESS_SPAWN_BLOCKED:'+name);};}
const cpAfter=await import('node:child_process');
const patched=cpAfter.spawn===cp.spawn&&cpAfter.spawnSync===cp.spawnSync;
// Readiness barrier: the parent arms its deadline only after the harness is loaded.
console.log('READY');
if(cfg.scenario==='hang'){
 setInterval(()=>{},1000);
 await new Promise(()=>{});
}
const canonicalRoot=await fsp.realpath(cfg.root);
const canonicalHome=await fsp.realpath(cfg.home);
const lockDir=join(canonicalHome,'.p2-manager-lock');
const ownerPath=join(lockDir,'owner.json');
const dataPath=canonicalHome;
const coordPath=join(canonicalRoot,'launch.bat');
const restorePath=join(canonicalRoot,'updates','hermes-restore-active.json');
const out={scenario:cfg.scenario,patched,guardEntered:false,guardObs:null,hits:[],spawnCalls:0,startError:null,lockDirAfter:null,reacquired:false,foreignOwner:null};
async function exists(p){
 try{const s=await origLstat(p);return {exists:true,directory:s.isDirectory(),file:s.isFile()};}
 catch(error){if(error.code==='ENOENT')return {exists:false};throw error;}
}
async function observe(){
 const lock=await exists(lockDir),owner=await exists(ownerPath);
 return {lockDir:lock.exists,owner:owner.exists,ownerText:owner.exists?await origRead(ownerPath,'utf8'):null};
}
async function inject(){
 if(cfg.inject==='tamper')await origWrite(coordPath,cfg.tamperBytes);
 if(cfg.inject==='restore'){await origMkdir(join(canonicalRoot,'updates'),{recursive:true});await origWrite(restorePath,cfg.restoreBytes);}
}
fsp.lstat=async function(path,...rest){
 const key=String(path);
 if(cfg.viaHook&&key===dataPath){
  const seen=await observe();
  out.hits.push({lockDir:seen.lockDir,owner:seen.owner});
  if(out.hits.length===cfg.injectAt)await inject();
 }
 return origLstat(path,...rest);
};
const legacyUrl=urlMod.pathToFileURL(join(cfg.workbench,'scripts','legacy-hermes-entry.mjs')).href;
const hermesUrl=urlMod.pathToFileURL(join(cfg.workbench,'scripts','hermes-instance.mjs')).href;
const guardUrl=urlMod.pathToFileURL(join(cfg.workbench,'scripts','portable-entry-guard.mjs')).href;
const lockUrl=urlMod.pathToFileURL(join(cfg.workbench,'scripts','instance-lock.mjs')).href;
const {assertPortableEntryGuard}=await import(guardUrl);
const {acquireInstanceLock}=await import(lockUrl);
if(cfg.scenario.startsWith('managed-')){
 const {startHermesInstance}=await import(hermesUrl);
 if(cfg.scenario==='managed-foreign'){
  await origMkdir(lockDir,{mode:0o700});
  await origWrite(ownerPath,cfg.foreignOwner,{flag:'wx'});
 }
 try{
  await startHermesInstance({python:cfg.python,source:cfg.source,home:cfg.home,environment:{},
   checkEntryGuard:async()=>{
    out.guardEntered=true;
    out.guardObs=await observe();
    if(cfg.scenario!=='managed-foreign')await inject();
    return assertPortableEntryGuard(cfg.root,cfg.home);
   }});
 }catch(error){out.startError=String(error&&error.message);}
}else{
 const {launchLegacy}=await import(legacyUrl);
 if(cfg.scenario==='legacy-foreign'){
  await origMkdir(lockDir,{mode:0o700});
  await origWrite(ownerPath,cfg.foreignOwner,{flag:'wx'});
 }
 try{
  await launchLegacy(['--root',cfg.root,'--',cfg.legacyCommand]);
 }catch(error){out.startError=String(error&&error.message);}
}
out.spawnCalls=spawnCalls;
out.lockDirAfter=(await exists(lockDir)).exists;
if(cfg.scenario.endsWith('foreign')){
 try{out.foreignOwner=await origRead(ownerPath,'utf8');}catch{out.foreignOwner=null;}
 try{await acquireInstanceLock(canonicalHome);out.reacquired=true;}catch{}
}else{
 try{const next=await acquireInstanceLock(canonicalHome);out.reacquired=true;await next.release();}catch{}
}
console.log(JSON.stringify(out));
`;

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'callers-guard-order-'));
 // Cleanup is opt-out: an unconfirmed child exit or undrained output keeps the
 // fixture. The same callback is returned so a test can prove it skips deletion.
 const guard={keep:false};
 const cleanup=()=>guard.keep?undefined:rm(root,{recursive:true,force:true});
 t.after(cleanup);
 const home=join(root,'data');
 const runtime=join(root,'.cache','runtimes','windows-x64');
 const source=join(root,'src','hermes-agent');
 const manifestBytes='{"schema":1,"synthetic":true}';
 const files=new Map([
  ['manifests/runtime-components.windows-x64.json',manifestBytes],
  ['.cache/runtimes/windows-x64/ready.flag',createHash('sha256').update(manifestBytes).digest('hex')],
  ['workbench/dist/index.html','<html><body>synthetic</body></html>'],
  ['.cache/runtimes/windows-x64/venv/Scripts/python.exe','synthetic-python-placeholder'],
  ['.cache/runtimes/windows-x64/git/bin/bash.exe','synthetic-bash-placeholder'],
  ['src/hermes-agent/hermes_cli/main.py','# synthetic main\n'],
 ]);
 for(const [path,content] of files){
  await mkdir(dirname(join(root,path)),{recursive:true});
  await writeFile(join(root,path),content);
 }
 await mkdir(home,{recursive:true});
 await mkdir(join(root,'.cache','windows-appdata'),{recursive:true});
 await mkdir(join(root,'.cache','windows-localappdata'),{recursive:true});
 for(const path of coordination){
  await mkdir(dirname(join(root,path)),{recursive:true});
  await writeFile(join(root,path),await readFile(join(repository,path)));
 }
 const canonical=await realpath(root);
 await writeFile(join(canonical,'.cache','runtimes','windows-x64','portable-location.txt'),canonical);
 return {root:canonical,home:await realpath(home),source:await realpath(source),python:process.execPath,guard,cleanup};
}

function waitFor(promise,ms){
 return new Promise(resolve=>{
  const timer=setTimeout(()=>resolve(false),ms);
  promise.then(()=>{clearTimeout(timer);resolve(true);},()=>{clearTimeout(timer);resolve(false);});
 });
}

const exists=async path=>{try{await realpath(path);return true;}catch{return false;}};

// Controllable child double: `close` and stream `end` are driven separately.
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

// Single-settlement driver shared by the real child and the double. The deadline
// is armed only after readiness; every termination waits a bounded time for
// `close` and for both output streams. Exit and drain are recorded separately and
// an unconfirmed cleanup keeps the fixture.
function drive(child,{guard=null,timeoutMs=90000,readyTimeoutMs=90000,closeGraceMs=10000,streamGraceMs=5000}={}){
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
  deadline=setTimeout(()=>{if(ready||settled)return;void terminate('CHILD_NOT_READY');},readyTimeoutMs);
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
    readiness=null;
    if(deadline)clearTimeout(deadline);
    deadline=setTimeout(()=>{void terminate('CHILD_TIMEOUT');},timeoutMs);
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

function runScenario(config,{guard=null,...rest}={}){
 const child=spawn(process.execPath,['--input-type=module','-e',CHILD],{
  env:{...process.env,CALLER_GUARD_CONFIG:JSON.stringify({...config,workbench,tamperBytes,restoreBytes,foreignOwner})},
  stdio:['ignore','pipe','pipe'],windowsHide:true});
 return drive(child,{guard,...rest});
}

test('managed caller rejects a launcher tampered after the lock owner exists',async t=>{
 const {root,home,source,python,guard}=await fixture(t);
 const seen=await runScenario({root,home,source,python,scenario:'managed-tamper',inject:'tamper',viaHook:false},{guard});
 assert.equal(seen.patched,true);
 assert.equal(seen.guardEntered,true);
 assert.equal(seen.guardObs.lockDir,true);
 assert.equal(seen.guardObs.owner,true);
 assert.match(String(seen.startError),/ENTRY_COORDINATION_UNCONFIRMED/);
 assert.equal(seen.spawnCalls,0);
 assert.equal(seen.lockDirAfter,false);
 assert.equal(seen.reacquired,true);
 assert.equal(guard.keep,false);
 assert.equal(await readFile(join(root,'launch.bat'),'utf8'),tamperBytes);
});

test('managed caller rejects a restore marker placed after the lock owner exists',async t=>{
 const {root,home,source,python,guard}=await fixture(t);
 const seen=await runScenario({root,home,source,python,scenario:'managed-restore',inject:'restore',viaHook:false},{guard});
 assert.equal(seen.guardEntered,true);
 assert.equal(seen.guardObs.lockDir,true);
 assert.equal(seen.guardObs.owner,true);
 assert.match(String(seen.startError),/INTERRUPTED_INSTALL_REQUIRES_RECOVERY/);
 assert.equal(seen.spawnCalls,0);
 assert.equal(seen.lockDirAfter,false);
 assert.equal(seen.reacquired,true);
 assert.equal(await readFile(join(root,'updates','hermes-restore-active.json'),'utf8'),restoreBytes);
});

test('managed caller refuses before the guard when another owner holds the lock',async t=>{
 const {root,home,source,python,guard}=await fixture(t);
 const seen=await runScenario({root,home,source,python,scenario:'managed-foreign',inject:null,viaHook:false},{guard});
 assert.match(String(seen.startError),/INSTANCE_LOCKED/);
 assert.equal(seen.guardEntered,false);
 assert.equal(seen.spawnCalls,0);
 assert.equal(seen.foreignOwner,foreignOwner);
 assert.equal(seen.reacquired,false);
});

test('legacy CLI caller rejects a launcher tampered at the guard barrier',{skip:process.platform!=='win32'},async t=>{
 const {root,home,guard}=await fixture(t);
 const seen=await runScenario({root,home,scenario:'legacy-cli-tamper',inject:'tamper',viaHook:true,injectAt:2,legacyCommand:'--cli'},{guard});
 assert.equal(seen.patched,true);
 assert.equal(seen.hits.length,2);
 assert.equal(seen.hits[1].lockDir,true);
 assert.equal(seen.hits[1].owner,true);
 assert.match(String(seen.startError),/ENTRY_COORDINATION_UNCONFIRMED/);
 assert.equal(seen.spawnCalls,0);
 assert.equal(seen.lockDirAfter,false);
 assert.equal(seen.reacquired,true);
 assert.equal(await readFile(join(root,'launch.bat'),'utf8'),tamperBytes);
});

test('legacy dashboard caller rejects a restore marker at the guard barrier',{skip:process.platform!=='win32'},async t=>{
 const {root,home,guard}=await fixture(t);
 const seen=await runScenario({root,home,scenario:'legacy-dashboard-restore',inject:'restore',viaHook:true,injectAt:2,legacyCommand:'dashboard'},{guard});
 assert.equal(seen.hits.length,2);
 assert.equal(seen.hits[1].lockDir,true);
 assert.equal(seen.hits[1].owner,true);
 assert.match(String(seen.startError),/INTERRUPTED_INSTALL_REQUIRES_RECOVERY/);
 assert.equal(seen.spawnCalls,0);
 assert.equal(seen.lockDirAfter,false);
 assert.equal(seen.reacquired,true);
 assert.equal(await readFile(join(root,'updates','hermes-restore-active.json'),'utf8'),restoreBytes);
});

test('legacy caller refuses before the guard when another owner holds the lock',{skip:process.platform!=='win32'},async t=>{
 const {root,home,guard}=await fixture(t);
 const seen=await runScenario({root,home,scenario:'legacy-foreign',inject:null,viaHook:true,injectAt:99,legacyCommand:'--cli'},{guard});
 assert.match(String(seen.startError),/INSTANCE_LOCKED/);
 assert.equal(seen.hits.length,1);
 assert.equal(seen.spawnCalls,0);
 assert.equal(seen.foreignOwner,foreignOwner);
 assert.equal(seen.reacquired,false);
});

test('unconfirmed drain on timeout keeps the root through the registered cleanup',async t=>{
 const {root,home,guard,cleanup}=await fixture(t);
 const sentinel=join(root,'sentinel.txt');
 await writeFile(sentinel,'keep-me');
 const fake=new FakeChild();
 fake.kill=function(){this.killed=true;this.closeWithoutDrain(0);return true;};
 const promise=drive(fake,{guard,timeoutMs:100,readyTimeoutMs:30000,closeGraceMs:500,streamGraceMs:200});
 fake.stdout.write('READY\n');
 let failure=null;
 try{await promise;}catch(error){failure=error;}
 assert.ok(failure,'an undrained timeout must not be a success');
 assert.equal(failure.code,'CHILD_TIMEOUT_CLEANUP_BLOCKED');
 assert.equal(failure.childExited,true);
 assert.equal(failure.streamsDrained,false);
 assert.equal(failure.cleanupConfirmed,false);
 assert.equal(guard.keep,true);
 await cleanup();
 assert.equal(await exists(root),true);
 assert.equal(await readFile(sentinel,'utf8'),'keep-me');
 await rm(root,{recursive:true,force:true});
});

test('child that never closes after kill keeps the root through the registered cleanup',async t=>{
 const {root,guard,cleanup}=await fixture(t);
 const sentinel=join(root,'sentinel.txt');
 await writeFile(sentinel,'keep-me');
 const fake=new FakeChild();
 // kill() never emits close: exercises the waitFor(closed) timeout branch.
 fake.kill=function(){this.killed=true;return true;};
 const promise=drive(fake,{guard,timeoutMs:100,readyTimeoutMs:30000,closeGraceMs:200,streamGraceMs:200});
 fake.stdout.write('READY\n');
 let failure=null;
 try{await promise;}catch(error){failure=error;}
 assert.ok(failure,'an unconfirmed exit must not be a success');
 assert.equal(fake.killed,true);
 assert.equal(failure.code,'CHILD_TIMEOUT_CLEANUP_BLOCKED');
 assert.equal(failure.childExited,false);
 assert.equal(failure.streamsDrained,false);
 assert.equal(failure.cleanupConfirmed,false);
 assert.equal(guard.keep,true);
 await cleanup();
 assert.equal(await exists(root),true);
 assert.equal(await readFile(sentinel,'utf8'),'keep-me');
 fake.stdout.end();fake.stderr.end();
 await rm(root,{recursive:true,force:true});
});

test('unconfirmed drain on close is reported and keeps the root',async t=>{
 const {root,guard,cleanup}=await fixture(t);
 const sentinel=join(root,'sentinel.txt');
 await writeFile(sentinel,'keep-me');
 const fake=new FakeChild();
 const promise=drive(fake,{guard,timeoutMs:30000,readyTimeoutMs:30000,closeGraceMs:500,streamGraceMs:200});
 fake.stdout.write('READY\n');
 fake.closeWithoutDrain(0);
 let failure=null;
 try{await promise;}catch(error){failure=error;}
 assert.ok(failure,'an undrained close must not be a success');
 assert.equal(failure.code,'CHILD_CLEANUP_UNCONFIRMED');
 assert.equal(failure.childExited,true);
 assert.equal(failure.streamsDrained,false);
 assert.equal(failure.cleanupConfirmed,false);
 assert.equal(guard.keep,true);
 await cleanup();
 assert.equal(await exists(root),true);
 assert.equal(await readFile(sentinel,'utf8'),'keep-me');
 await rm(root,{recursive:true,force:true});
});

test('post-spawn error waits for close and reports a runtime failure',async t=>{
 const {root,guard,cleanup}=await fixture(t);
 const fake=new FakeChild();
 const promise=drive(fake,{guard,timeoutMs:30000,readyTimeoutMs:30000,closeGraceMs:500,streamGraceMs:500});
 fake.stdout.write('READY\n');
 fake.emit('error',new Error('synthetic-runtime-error'));
 let settledEarly=false;
 promise.catch(()=>{settledEarly=true;});
 await Promise.resolve();
 await Promise.resolve();
 assert.equal(settledEarly,false,'the runtime error must not settle before close');
 fake.exit(0);
 let failure=null;
 try{await promise;}catch(error){failure=error;}
 assert.ok(failure,'a runtime error must fail');
 assert.equal(failure.code,'CHILD_ERROR_RUNTIME');
 assert.equal(failure.childExited,true);
 assert.equal(failure.cleanupConfirmed,true);
 assert.equal(guard.keep,false);
 await cleanup();
 assert.equal(await exists(root),false);
});

test('pre-spawn error is reported as a spawn failure and cleanup still runs',async t=>{
 const {root,guard,cleanup}=await fixture(t);
 const fake=new FakeChild();
 fake.pid=undefined;
 const promise=drive(fake,{guard,timeoutMs:30000,readyTimeoutMs:30000});
 fake.emit('error',Object.assign(new Error('spawn ENOENT'),{code:'ENOENT'}));
 let failure=null;
 try{await promise;}catch(error){failure=error;}
 assert.ok(failure,'a spawn failure must reject');
 assert.equal(failure.code,'CHILD_SPAWN_FAILED');
 assert.equal(failure.childExited,true);
 assert.equal(failure.cleanupConfirmed,true);
 assert.equal(guard.keep,false);
 await cleanup();
 assert.equal(await exists(root),false);
});
