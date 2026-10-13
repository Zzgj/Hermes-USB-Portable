import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import ts from 'typescript';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

// Disposable children bound known-red listeners and isolate built-in injection.
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'p2-boundary-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'assets'));await writeFile(join(root,'assets','index.html'),'fixture');
 return root;
}
function run(source){
 const result=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8',timeout:7000});
 assert.equal(result.status,0,'owned probe must finish without exposing raw diagnostics');
 return JSON.parse(result.stdout);
}

test('actual launcher shutdown keeps retry controls after failure and closes them only on success',async()=>{
 const text=await readFile(new URL('../scripts/launch-managed.mjs',import.meta.url),'utf8');
 const tree=ts.createSourceFile('launch-managed.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),found=[];
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='shutdown')found.push(node.initializer.getText(tree));ts.forEachChild(node,visit);}visit(tree);
 assert.equal(found.length,1);
 let attempts=0,closed=0;const proc=new EventEmitter(),logs=[];
 const shutdown=new Function('control','input','process','console',`let stopping=false;const shutdown=${found[0]};return shutdown;`)(
  {close:async()=>{if(++attempts===1)throw new Error('synthetic');}},
  {close:()=>{closed++;}},proc,{log:()=>logs.push('stopped'),error:()=>logs.push('unconfirmed')});
 proc.on('SIGINT',shutdown);proc.on('SIGTERM',shutdown);
 await shutdown();assert.equal(closed,0);assert.equal(proc.listenerCount('SIGINT'),1);
 await shutdown();assert.equal(attempts,2);assert.equal(closed,1);assert.equal(proc.listenerCount('SIGINT'),0);
 assert.deepEqual(logs,['unconfirmed','stopped']);
});

test('close failure closes HTTP, retains stop error and allows an explicit retry',async t=>{
 const root=await fixture(t),moduleUrl=new URL('../scripts/control-server.mjs',import.meta.url).href;
 const result=run(`
 import {startControlServer} from ${JSON.stringify(moduleUrl)};
 let stops=0;const failure=new Error('SYNTHETIC_STOP_FAILURE');
 const control=await startControlServer({assets:${JSON.stringify(join(root,'assets'))},startInstance:async()=>({state:'ready',connection:Promise.resolve({port:12345,token:'synthetic'}),stop:async()=>{if(++stops===1)throw failure;}})});
 try{
  const response=await fetch(control.origin+'/api/start',{method:'POST',headers:{Origin:control.origin,Authorization:'Bearer '+control.token}});await response.arrayBuffer();
  const first=control.close(),same=control.close();let retained=false;
  try{await first;}catch(error){retained=error===failure;}
  let reachable=false;try{const r=await fetch(control.origin+'/',{signal:AbortSignal.timeout(600)});await r.arrayBuffer();reachable=true;}catch{}
  let retried=false;try{await control.close();retried=true;}catch{}
  await control.close().catch(()=>{});
  console.log(JSON.stringify({started:response.status===200,shared:first===same,retained,reachable,retried,stops}));process.exit(0);
 }catch{process.exit(1);}`);
 assert.equal(result.started,true);assert.equal(result.shared,true);assert.equal(result.retained,true);
 assert.equal(result.reachable,false,'a rejected stop must not leave the listener accepting requests');
 assert.equal(result.retried,true);assert.equal(result.stops,2);
});

test('startup rechecks recovery marker under its newly acquired lock before spawning',async t=>{
 const root=await fixture(t),moduleUrl=new URL('../scripts/hermes-instance.mjs',import.meta.url).href;
 const result=run(`
 import fs from 'node:fs/promises';import cp from 'node:child_process';
 import {syncBuiltinESMExports} from 'node:module';import {join} from 'node:path';
 import {startHermesInstance} from ${JSON.stringify(moduleUrl)};
 const root=${JSON.stringify(root)},home=join(root,'data'),source=join(root,'source'),marker=join(root,'logs','diagnostics','p2-install-active.json');
 await fs.mkdir(home);await fs.mkdir(join(source,'hermes_cli'),{recursive:true});await fs.writeFile(join(source,'hermes_cli','main.py'),'# synthetic');await fs.mkdir(join(root,'logs','diagnostics'),{recursive:true});
 // Production code resolves home via realpath before lock acquisition; on Windows
 // the temp path may contain 8.3 short names that differ from the resolved path.
 // Use the resolved path for mock comparison to match production behavior.
 const homeResolved=await fs.realpath(home);
 const mkdir=fs.mkdir,spawn=cp.spawn;let injected=false,calls=0,error;
 fs.mkdir=async(path,...args)=>{if(path===join(homeResolved,'.p2-manager-lock')){await fs.writeFile(marker,'synthetic-recovery-marker',{flag:'wx'});injected=true;}return mkdir(path,...args);};
 cp.spawn=()=>{calls++;throw new Error('FORBIDDEN_SPAWN');};syncBuiltinESMExports();
 try{await startHermesInstance({python:process.execPath,source,home,environment:{}});}catch(e){error=e.message;}finally{fs.mkdir=mkdir;cp.spawn=spawn;syncBuiltinESMExports();}
 const exists=async path=>{try{await fs.lstat(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
 console.log(JSON.stringify({injected,calls,rejected:error==='INTERRUPTED_INSTALL_REQUIRES_RECOVERY',markerRetained:(await fs.readFile(marker,'utf8'))==='synthetic-recovery-marker',lockReleased:!await exists(join(homeResolved,'.p2-manager-lock'))}));`);
 assert.equal(result.injected,true);assert.equal(result.calls,0,'recovery marker must block actual spawn');
 assert.equal(result.rejected,true);assert.equal(result.markerRetained,true);assert.equal(result.lockReleased,true);
});
