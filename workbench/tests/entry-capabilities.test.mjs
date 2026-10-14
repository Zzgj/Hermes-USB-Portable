import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startControlServer} from '../scripts/control-server.mjs';

async function fixture(t,options={}){
 const root=await mkdtemp(join(tmpdir(),'p2-entry-capabilities-'));
 const assets=join(root,'dist'),source=join(root,'source');
 await mkdir(assets);await mkdir(join(source,'hermes_cli'),{recursive:true});
 await writeFile(join(assets,'index.html'),'synthetic');
 let starts=0;
 const control=await startControlServer({assets,source,startInstance:async()=>{starts++;throw new Error('FORBIDDEN_START');},...options});
 t.after(async()=>{try{await control.close();}finally{await rm(root,{recursive:true,force:true});}});
 const get=(path='/api/entry-capabilities',headers={})=>fetch(control.origin+path,{headers:{Authorization:'Bearer '+control.token,Origin:control.origin,...headers}});
 return {root,assets,source,control,get,starts:()=>starts};
}
const row=(body,kind)=>body.entries.find(entry=>entry.kind===kind);

test('versioned capabilities distinguish workbench from missing native dashboard without starting',async t=>{
 const h=await fixture(t);const response=await h.get();
 assert.equal(response.status,200);const body=await response.json();
 assert.equal(body.schemaVersion,1);
 assert.deepEqual(body.entries.map(e=>e.kind),['workbench','cli','tui','dashboard','desktop']);
 assert.equal(row(body,'workbench').assetState,'present');
 assert.equal(row(body,'dashboard').assetState,'missing');
 assert.equal(h.starts(),0);
 for(const entry of body.entries){
  assert.equal(entry.dependencies,'unverified');assert.equal(entry.runtime,'unknown');
  assert.deepEqual(entry.launch,{allowed:false,reason:'LIFECYCLE_NOT_INTEGRATED'});
 }
 assert.ok(!JSON.stringify(body).includes(h.root));
});

test('asset observations do not imply dependencies or launch readiness',async t=>{
 const h=await fixture(t);
 await writeFile(join(h.source,'hermes_cli','main.py'),'synthetic');
 await mkdir(join(h.source,'ui-tui','node_modules'),{recursive:true});
 await mkdir(join(h.source,'desktop','node_modules'),{recursive:true});
 await mkdir(join(h.source,'hermes_cli','web_dist'),{recursive:true});
 await writeFile(join(h.source,'hermes_cli','web_dist','index.html'),'synthetic');
 const body=await (await h.get()).json();
 assert.equal(body.entries.length,5);
 for(const entry of body.entries){assert.equal(entry.assetState,'present');assert.equal(entry.launch.allowed,false);assert.equal(entry.dependencies,'unverified');}
 assert.equal(h.starts(),0);
});

test('wrong asset types are invalid rather than present',async t=>{
 const h=await fixture(t);
 await mkdir(join(h.source,'hermes_cli','main.py'));
 await mkdir(join(h.source,'ui-tui'));await writeFile(join(h.source,'ui-tui','node_modules'),'not a directory');
 const body=await (await h.get()).json();
 assert.equal(row(body,'cli').assetState,'invalid');assert.equal(row(body,'tui').assetState,'invalid');
});

test('asset paths escaping configured root are refused',{skip:process.platform==='win32'?'symlink privilege not assumed':false},async t=>{
 const h=await fixture(t);const outside=join(h.root,'outside.py');await writeFile(outside,'synthetic');
 await symlink(outside,join(h.source,'hermes_cli','main.py'));
 const body=await (await h.get()).json();assert.equal(row(body,'cli').assetState,'invalid');
});

test('capabilities require management authentication and reject foreign Origin',async t=>{
 let calls=0;const h=await fixture(t,{inspectEntries:async()=>{calls++;throw new Error('not reached');}});
 assert.equal((await h.get(undefined,{Authorization:'Bearer wrong'})).status,403);
 assert.equal((await h.get(undefined,{Origin:'http://foreign.invalid'})).status,403);
 assert.equal(calls,0);
});

test('capabilities cannot accept caller paths or become a launch command',async t=>{
 const h=await fixture(t);
 assert.equal((await h.get('/api/entry-capabilities?source=arbitrary')).status,400);
 const response=await fetch(h.control.origin+'/api/entry-capabilities',{method:'POST',headers:{Authorization:'Bearer '+h.control.token,Origin:h.control.origin}});
 assert.equal(response.status,404);assert.equal(h.starts(),0);
});

test('inspection failure exposes a fixed code, not private errors',async t=>{
 const h=await fixture(t,{inspectEntries:async()=>{throw new Error('PRIVATE_CONFIG_AND_PATH');}});
 const response=await h.get();assert.equal(response.status,400);
 assert.deepEqual(await response.json(),{error:'ENTRY_CAPABILITIES_FAILED'});
});

test('missing configured source remains unknown',async t=>{
 const h=await fixture(t,{source:undefined});const body=await (await h.get()).json();
 assert.equal(row(body,'cli').assetState,'unknown');assert.equal(row(body,'dashboard').assetState,'unknown');
});

function snapshot(){return {schemaVersion:1,entries:['workbench','cli','tui','dashboard','desktop'].map(kind=>({kind,assetState:'present'}))};}

test('projection drops private fields and refuses enablement from the inspector',async t=>{
 const value=snapshot();value.secret='PRIVATE';
 for(const item of value.entries){Object.assign(item,{path:'/PRIVATE',command:'PRIVATE',dependencies:'ready',runtime:'ready',launch:{allowed:true}});}
 const h=await fixture(t,{inspectEntries:async()=>value});const body=await (await h.get()).json();
 assert.ok(!JSON.stringify(body).includes('PRIVATE'));
 for(const item of body.entries){assert.equal(item.launch.allowed,false);assert.equal(item.runtime,'unknown');assert.equal(item.dependencies,'unverified');}
});

test('unknown schema, duplicate entries and unknown asset states fail closed',async t=>{
 let value=snapshot();const h=await fixture(t,{inspectEntries:async()=>value});
 value.schemaVersion=2;assert.equal((await h.get()).status,400);
 value=snapshot();value.entries[1].kind='workbench';assert.equal((await h.get()).status,400);
 value=snapshot();value.entries[1].assetState='ready';assert.equal((await h.get()).status,400);
});

test('eight held reads are bounded without blocking manager status or stop',async t=>{
 let announce,release,calls=0;const entered=new Promise(r=>{announce=r;}),held=new Promise(r=>{release=r;});
 const h=await fixture(t,{inspectEntries:async()=>{if(++calls===8)announce();await held;return snapshot();}});
 t.after(()=>release());
 const requests=Array.from({length:8},()=>h.get());await entered;
 assert.equal((await h.get()).status,429);
 assert.equal((await h.get('/api/status')).status,200);
 assert.equal((await fetch(h.control.origin+'/api/stop',{method:'POST',headers:{Authorization:'Bearer '+h.control.token,Origin:h.control.origin}})).status,200);
 release();for(const response of await Promise.all(requests)){assert.equal(response.status,200);await response.json();}
 assert.equal((await h.get()).status,200);assert.equal(h.starts(),0);
});

test('shutdown cancels a held inspection without waiting for its callback',async t=>{
 let announce,signal;const entered=new Promise(r=>{announce=r;});
 const h=await fixture(t,{inspectEntries:async options=>{signal=options.signal;announce();return new Promise(()=>{});}});
 const pending=h.get();await entered;await h.control.close();
 assert.equal(signal.aborted,true);assert.equal((await pending).status,400);
});

test('inspection deadline returns fixed failure and aborts the signal',{timeout:8000},async t=>{
 let signal;const h=await fixture(t,{inspectEntries:async options=>{signal=options.signal;return new Promise(()=>{});}});
 const response=await h.get();assert.equal(response.status,400);assert.equal(signal.aborted,true);
 assert.deepEqual(await response.json(),{error:'ENTRY_CAPABILITIES_FAILED'});
});

test('legacy entries retain their existing response contract',async t=>{
 const entries=[{kind:'web',available:true,note:'legacy'}];const h=await fixture(t,{detectEntries:async()=>entries});
 const response=await h.get('/api/entries');assert.equal(response.status,200);assert.deepEqual(await response.json(),{entries});
});

test('client disconnect cancels inspection and a later request still works',{timeout:4000},async t=>{
 let announce,acknowledge,calls=0;
 const entered=new Promise(r=>{announce=r;}),aborted=new Promise(r=>{acknowledge=r;});
 const h=await fixture(t,{inspectEntries:async({signal})=>{
  if(++calls>1)return snapshot();
  signal.addEventListener('abort',()=>acknowledge(),{once:true});announce();return new Promise(()=>{});
 }});
 const controller=new AbortController();
 const pending=fetch(h.control.origin+'/api/entry-capabilities',{signal:controller.signal,headers:{Authorization:'Bearer '+h.control.token,Origin:h.control.origin}}).then(()=>false,error=>error.name==='AbortError');
 await entered;controller.abort();assert.equal(await pending,true);await aborted;
 assert.equal((await h.get()).status,200);
});
