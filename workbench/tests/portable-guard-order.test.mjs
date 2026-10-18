import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

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
 t.after(()=>rm(root,{recursive:true,force:true}));
 const home=join(root,'data');
 await mkdir(home);
 for(const path of coordination){
  await mkdir(dirname(join(root,path)),{recursive:true});
  await writeFile(join(root,path),await readFile(join(repository,path)));
 }
 return {root:await realpath(root),home:await realpath(home)};
}

function runChild(config){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--input-type=module','-e',CHILD],{
   env:{...process.env,GUARD_ORDER_CONFIG:JSON.stringify({...config,workbench})},
   stdio:['ignore','pipe','pipe'],windowsHide:true});
  let stdout='',stderr='';
  const timer=setTimeout(()=>{child.kill();reject(new Error('CHILD_TIMEOUT'));},60000);
  child.stdout.on('data',chunk=>{stdout+=chunk;});
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  child.on('close',code=>{
   clearTimeout(timer);
   const line=stdout.trim().split(/\r?\n/).filter(Boolean).pop();
   if(code!==0||!line)return reject(new Error('CHILD_FAILED code='+code+' stderr='+stderr));
   try{resolve(JSON.parse(line));}catch(error){reject(new Error('CHILD_OUTPUT_INVALID '+error.message));}
  });
 });
}

test('guard reads the coordinated launcher after the lock owner exists and exactly once',async t=>{
 const {root,home}=await fixture(t);
 const seen=await runChild({root,home,scenario:'normal'});
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
});

test('recovery marker created at the guard barrier rejects without adapter effects and keeps bytes',async t=>{
 const {root,home}=await fixture(t);
 const seen=await runChild({root,home,scenario:'marker',markerBytes});
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
 const {root,home}=await fixture(t);
 const seen=await runChild({root,home,scenario:'tamper',tamperBytes});
 assert.match(String(seen.startError),/ENTRY_COORDINATION_UNCONFIRMED/);
 assert.deepEqual(seen.events,[]);
 assert.equal(seen.guardReads.length,1);
 assert.equal(seen.guardReads[0].lockDir,true);
 assert.equal(seen.lockDirAfterOutcome,false);
 assert.equal(seen.reacquired,true);
 assert.equal(await readFile(join(root,'launch.bat'),'utf8'),tamperBytes);
});

test('pre-existing foreign lock rejects before guard and leaves owner bytes unchanged',async t=>{
 const {root,home}=await fixture(t);
 const seen=await runChild({root,home,scenario:'foreign',foreignOwner});
 assert.match(String(seen.startError),/INSTANCE_LOCKED/);
 assert.deepEqual(seen.events,[]);
 assert.equal(seen.guardReads.length,0);
 assert.equal(seen.guardEntry.length,0);
 assert.equal(seen.foreignOwner,foreignOwner);
 assert.equal(seen.reacquired,false);
 assert.equal(await readFile(join(home,'.p2-manager-lock','owner.json'),'utf8'),foreignOwner);
});
