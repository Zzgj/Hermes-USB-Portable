import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startControlServer} from '../scripts/control-server.mjs';

test('native commands require auth and Origin; refuse payload and shared-instance start',async t=>{
 const root=await mkdtemp(join(tmpdir(),'native-control-'));
 await writeFile(join(root,'index.html'),'test');
 let kind=null,state='idle',starts=0,opens=0;
 const server=await startControlServer({assets:root,startInstance:async()=>{throw new Error('must not start');},nativeEntries:{
  status:()=>({kind,state,secret:'must not project'}),
  start:async value=>{starts++;kind=value;state='running';},
  stop:async()=>{state='idle';kind=null;},
  open:async()=>{if(kind!=='dashboard'||state!=='running')throw new Error('not ready');opens++;},
 }});
 t.after(async()=>{await server.close();await rm(root,{recursive:true,force:true});});
 const headers={Authorization:`Bearer ${server.token}`,Origin:server.origin};
 const path='/api/native-entry/cli/start';
 assert.equal((await fetch(server.origin+path,{method:'POST'})).status,403);
 assert.equal((await fetch(server.origin+path,{method:'POST',headers:{...headers,Origin:'http://invalid'}})).status,403);
 assert.equal((await fetch(server.origin+path,{method:'POST',headers,body:'{}'})).status,400);
 assert.equal(starts,0);
 assert.equal((await fetch(server.origin+path,{method:'POST',headers})).status,202);
 assert.equal(starts,1);
 const status=await (await fetch(server.origin+'/api/native-entry/status',{headers})).json();
 assert.deepEqual(status,{kind:'cli',state:'running'});
 assert.equal((await fetch(server.origin+'/api/start',{method:'POST',headers})).status,409);
 assert.equal((await fetch(server.origin+'/api/native-entry/stop',{method:'POST',headers})).status,202);
 assert.equal((await fetch(server.origin+'/api/native-entry/dashboard/open',{method:'POST',headers})).status,409);
 assert.equal(opens,0);
 assert.equal((await fetch(server.origin+'/api/native-entry/dashboard/start',{method:'POST',headers})).status,202);
 assert.equal((await fetch(server.origin+'/api/native-entry/dashboard/open?url=http://invalid',{method:'POST',headers})).status,400);
 assert.equal((await fetch(server.origin+'/api/native-entry/dashboard/open',{method:'POST',headers,body:'{}'})).status,400);
 assert.equal(opens,0);
 assert.equal((await fetch(server.origin+'/api/native-entry/dashboard/open',{method:'POST',headers})).status,202);
 assert.equal(opens,1);
});

test('native and managed mutations share busy admission without duplicate starts',async t=>{
 const root=await mkdtemp(join(tmpdir(),'native-busy-'));await writeFile(join(root,'index.html'),'fixture');
 let release,entered,starts=0,state='idle';
 const held=new Promise(resolve=>{release=resolve;}),barrier=new Promise(resolve=>{entered=resolve;});
 const server=await startControlServer({assets:root,startInstance:async()=>{throw new Error('forbidden');},nativeEntries:{
  status:()=>({kind:state==='idle'?null:'cli',state}),
  start:async()=>{starts++;state='starting';entered();await held;state='running';},stop:async()=>{state='idle';},
 }});
 t.after(async()=>{release();await server.close();await rm(root,{recursive:true,force:true});});
 const headers={Authorization:`Bearer ${server.token}`,Origin:server.origin};
 const first=fetch(server.origin+'/api/native-entry/cli/start',{method:'POST',headers});await barrier;
 for(const path of ['/api/native-entry/cli/start','/api/native-entry/dashboard/start','/api/start']){
  assert.equal((await fetch(server.origin+path,{method:'POST',headers})).status,409);
 }
 assert.equal(starts,1);release();assert.equal((await first).status,202);
});

test('unconfirmed native shutdown closes listener but preserves explicit cleanup retry',async t=>{
 const root=await mkdtemp(join(tmpdir(),'native-close-'));await writeFile(join(root,'index.html'),'fixture');
 let state='running',stops=0;
 const server=await startControlServer({assets:root,startInstance:async()=>{},nativeEntries:{
  status:()=>({kind:'cli',state}),stop:async()=>{stops++;state=stops===1?'unknown':'idle';},
 }});
 t.after(async()=>{await server.close();await rm(root,{recursive:true,force:true});});
 await assert.rejects(server.close(),/NATIVE_ENTRY_EXIT_UNCONFIRMED/);
 assert.equal(state,'unknown');assert.equal(stops,1);
 await assert.rejects(fetch(server.origin+'/api/status'));
 await server.close();assert.equal(stops,2);assert.equal(state,'idle');
});
