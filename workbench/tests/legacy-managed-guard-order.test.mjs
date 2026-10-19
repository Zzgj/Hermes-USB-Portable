import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

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
const entries=urlMod.pathToFileURL(join(cfg.workbench,'scripts','portable-native-entries.mjs')).href;
const legacyUrl=urlMod.pathToFileURL(join(cfg.workbench,'scripts','legacy-hermes-entry.mjs')).href;
const hermesUrl=urlMod.pathToFileURL(join(cfg.workbench,'scripts','hermes-instance.mjs')).href;
const guardUrl=urlMod.pathToFileURL(join(cfg.workbench,'scripts','portable-entry-guard.mjs')).href;
const lockUrl=urlMod.pathToFileURL(join(cfg.workbench,'scripts','instance-lock.mjs')).href;
const {assertPortableEntryGuard}=await import(guardUrl);
const {acquireInstanceLock}=await import(lockUrl);
if(cfg.scenario==='managed-tamper'||cfg.scenario==='managed-restore'||cfg.scenario==='managed-foreign'){
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

function drive(child,{timeoutMs=90000,closeGraceMs=10000}={}){
 return new Promise((resolve,reject)=>{
  let stdout='',stderr='',settled=false,terminated=false;
  const closed=new Promise(done=>child.on('close',(code,signal)=>done({code,signal})));
  const finish=(fn,value)=>{if(settled)return;settled=true;fn(value);};
  const timer=setTimeout(async()=>{
   if(settled)return;
   terminated=true;
   child.kill();
   const exited=await Promise.race([closed.then(()=>true),new Promise(done=>setTimeout(()=>done(false),closeGraceMs))]);
   const error=new Error(exited?'CHILD_TIMEOUT':'CHILD_TIMEOUT_CLEANUP_BLOCKED');
   error.code=exited?'CHILD_TIMEOUT':'CHILD_TIMEOUT_CLEANUP_BLOCKED';
   finish(reject,error);
  },timeoutMs);
  child.on('error',error=>{clearTimeout(timer);finish(reject,Object.assign(new Error('CHILD_SPAWN_FAILED: '+error.message),{code:'CHILD_SPAWN_FAILED',cause:error}));});
  child.stdout.on('data',chunk=>{stdout+=chunk;});
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  child.on('close',code=>{
   clearTimeout(timer);
   if(terminated)return;
   const line=stdout.trim().split(/\r?\n/).filter(Boolean).pop();
   if(code!==0||!line)return finish(reject,Object.assign(new Error('CHILD_FAILED code='+code+' stderr='+stderr),{code:'CHILD_FAILED',exitCode:code}));
   try{finish(resolve,JSON.parse(line));}catch(error){finish(reject,Object.assign(new Error('CHILD_OUTPUT_INVALID '+error.message),{code:'CHILD_OUTPUT_INVALID'}));}
  });
 });
}

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'callers-guard-order-'));
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

function runScenario(config){
 const child=spawn(process.execPath,['--input-type=module','-e',CHILD],{
  env:{...process.env,CALLER_GUARD_CONFIG:JSON.stringify({...config,workbench,tamperBytes,restoreBytes,foreignOwner})},
  stdio:['ignore','pipe','pipe'],windowsHide:true});
 return drive(child);
}

test('managed caller rejects a launcher tampered after the lock owner exists',async t=>{
 const {root,home,source,python}=await fixture(t);
 const seen=await runScenario({root,home,source,python,scenario:'managed-tamper',inject:'tamper',viaHook:false});
 assert.equal(seen.patched,true);
 assert.equal(seen.guardEntered,true);
 assert.equal(seen.guardObs.lockDir,true);
 assert.equal(seen.guardObs.owner,true);
 assert.match(String(seen.startError),/ENTRY_COORDINATION_UNCONFIRMED/);
 assert.equal(seen.spawnCalls,0);
 assert.equal(seen.lockDirAfter,false);
 assert.equal(seen.reacquired,true);
 assert.equal(await readFile(join(root,'launch.bat'),'utf8'),tamperBytes);
});

test('managed caller rejects a restore marker placed after the lock owner exists',async t=>{
 const {root,home,source,python}=await fixture(t);
 const seen=await runScenario({root,home,source,python,scenario:'managed-restore',inject:'restore',viaHook:false});
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
 const {root,home,source,python}=await fixture(t);
 const seen=await runScenario({root,home,source,python,scenario:'managed-foreign',inject:null,viaHook:false});
 assert.match(String(seen.startError),/INSTANCE_LOCKED/);
 assert.equal(seen.guardEntered,false);
 assert.equal(seen.spawnCalls,0);
 assert.equal(seen.foreignOwner,foreignOwner);
 assert.equal(seen.reacquired,false);
});

test('legacy CLI caller rejects a launcher tampered at the guard barrier',{skip:process.platform!=='win32'},async t=>{
 const {root,home}=await fixture(t);
 const seen=await runScenario({root,home,scenario:'legacy-cli-tamper',inject:'tamper',viaHook:true,injectAt:2,legacyCommand:'--cli'});
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
 const {root,home}=await fixture(t);
 const seen=await runScenario({root,home,scenario:'legacy-dashboard-restore',inject:'restore',viaHook:true,injectAt:2,legacyCommand:'dashboard'});
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
 const {root,home}=await fixture(t);
 const seen=await runScenario({root,home,scenario:'legacy-foreign',inject:null,viaHook:true,injectAt:99,legacyCommand:'--cli'});
 assert.match(String(seen.startError),/INSTANCE_LOCKED/);
 assert.equal(seen.hits.length,1);
 assert.equal(seen.spawnCalls,0);
 assert.equal(seen.foreignOwner,foreignOwner);
 assert.equal(seen.reacquired,false);
});
