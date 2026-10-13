// Real loopback management HTTP + synthetic upstream; no Hermes/model/private data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import ts from 'typescript';
import {startControlServer} from '../scripts/control-server.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=2000){const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw new Error('BOUNDARY_WAIT_TIMEOUT');await sleep(10);}}
async function fixture(t){
 const assets=await mkdtemp(join(tmpdir(),'history-boundary-'));
 await writeFile(join(assets,'index.html'),'synthetic');
 let handler=(req,res)=>res.end(JSON.stringify({session_id:'id',messages:[{role:'user',content:'safe'}]}));
 const stats={seen:0,closed:0,stops:0,auth:false},sockets=new Set();
 const upstream=createServer((req,res)=>{stats.seen++;stats.auth=req.headers.authorization==='Bearer upstream-only';res.on('close',()=>stats.closed++);handler(req,res);});
 upstream.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const control=await startControlServer({assets,readCatalog:async()=>({cards:[]}),startInstance:async()=>({state:'ready',connection:Promise.resolve({port:upstream.address().port,token:'upstream-only'}),stop:async()=>{stats.stops++;}})});
 const api=(path,options={})=>fetch(control.origin+path,{signal:AbortSignal.timeout(22000),...options,headers:{Authorization:'Bearer '+control.token,Origin:control.origin,...options.headers}});
 t.after(async()=>{for(const s of sockets)s.destroy();await new Promise(r=>upstream.close(r));await control.close();await rm(assets,{recursive:true,force:true});});
 assert.equal((await api('/api/start',{method:'POST'})).status,200);
 return {stats,control,api,setHandler:fn=>{handler=fn;},hold:()=>{handler=(req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.write('{');};}};
}
test('history body deadline remains active after upstream headers',{timeout:23000},async t=>{
 const f=await fixture(t);f.hold();const started=Date.now();
 const response=await f.api('/api/sessions/id/messages',{signal:AbortSignal.timeout(17500)});
 assert.equal(response.status,502);assert.ok(Date.now()-started<17000);await response.json();
 await until(()=>f.stats.closed===1);assert.equal((await f.api('/api/connection')).status,200);
});
test('slow history does not lock catalog or connection; stop cancels upstream',async t=>{
 const f=await fixture(t);f.hold();const read=f.api('/api/sessions/id/messages');
 await until(()=>f.stats.seen===1);
 assert.equal((await f.api('/api/capabilities/catalog')).status,200);
 assert.equal((await f.api('/api/connection')).status,200);
 assert.equal((await f.api('/api/stop',{method:'POST'})).status,200);
 assert.notEqual((await read).status,200);await until(()=>f.stats.closed===1);assert.equal(f.stats.stops,1);
});
test('downstream disconnect after complete GET cancels upstream body',async t=>{
 const f=await fixture(t);f.hold();const abort=new AbortController();
 const read=f.api('/api/sessions/id/messages',{signal:abort.signal}).catch(()=>null);
 await until(()=>f.stats.seen===1);abort.abort();await read;await until(()=>f.stats.closed===1);
 assert.equal((await f.api('/api/connection')).status,200);
});
test('server close aborts pending transcript before waiting on listener',async t=>{
 const f=await fixture(t);f.hold();const read=f.api('/api/sessions/id/messages').catch(()=>null);
 await until(()=>f.stats.seen===1);let closed=false;const stop=f.control.close().then(()=>{closed=true;});
 await until(()=>closed);await stop;await read;assert.equal(f.stats.stops,1);assert.equal(f.stats.closed,1);
});
test('normal delayed body is not aborted when incoming GET completes',async t=>{
 const f=await fixture(t);f.setHandler((req,res)=>{res.writeHead(200);res.write('{');setTimeout(()=>res.end('"session_id":"id","messages":[]}'),60);});
 const response=await f.api('/api/sessions/id/messages');assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{sessionId:'id',messages:[],omitted:false});assert.equal(f.stats.auth,true);
});
test('history concurrency is bounded independently and restart admits only fresh reads',async t=>{
 const f=await fixture(t);f.hold();const reads=Array.from({length:8},()=>f.api('/api/sessions/id/messages'));
 await until(()=>f.stats.seen===8);
 assert.equal((await f.api('/api/sessions/id/messages')).status,429);assert.equal(f.stats.seen,8);
 assert.equal((await f.api('/api/status')).status,200);
 assert.equal((await f.api('/api/stop',{method:'POST'})).status,200);
 for(const response of await Promise.all(reads))assert.notEqual(response.status,200);
 await until(()=>f.stats.closed===8);
 f.setHandler((req,res)=>res.end(JSON.stringify({session_id:'new-id',messages:[{role:'user',content:'fresh'}]})));
 assert.equal((await f.api('/api/start',{method:'POST'})).status,200);
 assert.deepEqual(await(await f.api('/api/sessions/id/messages')).json(),{sessionId:'new-id',messages:[{role:'user',text:'fresh'}],omitted:false});
});
test('oversized upstream and refused streaming bodies are cancelled; later reads work',async t=>{
 const f=await fixture(t);
 f.setHandler((req,res)=>{res.writeHead(200);res.write('x'.repeat(1048577));});
 assert.equal((await f.api('/api/sessions/id/messages')).status,502);await until(()=>f.stats.closed===1);
 f.setHandler((req,res)=>{res.writeHead(403);res.write('synthetic-denial');});
 assert.equal((await f.api('/api/sessions/id/messages')).status,502);await until(()=>f.stats.closed===2);
 f.setHandler((req,res)=>res.end(JSON.stringify({session_id:'id',messages:[]})));
 assert.equal((await f.api('/api/sessions/id/messages')).status,200);
});
test('management auth and origin reject before upstream; projection excludes raw fields',async t=>{
 const f=await fixture(t);
 for(const headers of [{Authorization:'Bearer upstream-only'},{Origin:'http://untrusted.invalid'}])assert.equal((await f.api('/api/sessions/id/messages',{headers})).status,403);
 assert.equal(f.stats.seen,0);
 f.setHandler((req,res)=>res.end(JSON.stringify({session_id:'id',token:'synthetic-secret',messages:[{role:'tool',content:'hidden'},{role:'assistant',display_kind:'hidden',content:'hidden'},{role:'user',content:'plain',token:'drop'}]})));
 const response=await f.api('/api/sessions/id/messages');assert.deepEqual(await response.json(),{sessionId:'id',messages:[{role:'user',text:'plain'}],omitted:true});
});
test('proxy rejects invalid upstream identity and excess message count',async t=>{
 const f=await fixture(t);
 for(const value of [{session_id:'../bad',messages:[]},{session_id:'id',messages:Array(51).fill({role:'user',content:'x'})}]){
  f.setHandler((req,res)=>res.end(JSON.stringify(value)));assert.equal((await f.api('/api/sessions/id/messages')).status,502);
 }
});
const source=await readFile(new URL('../src/domain/session-history.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {readTranscript}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('client consumes only projected proxy format with bounded plain text',async()=>{
 const result=await readTranscript({port:0,token:'management-only'},'id',new AbortController().signal,async()=>new Response(JSON.stringify({sessionId:'resolved-id',messages:[{role:'user',text:'safe'}],omitted:false,secret:'drop'})));
 assert.deepEqual(result,{sessionId:'resolved-id',messages:[{role:'user',text:'safe'}],omitted:false});
});
test('client rejects direct mode without sending management token',async()=>{
 let calls=0;await assert.rejects(()=>readTranscript({port:1234,token:'management-only'},'id',new AbortController().signal,async()=>{calls++;return new Response('{}');}),/HISTORY_DIRECT_UNSUPPORTED/);assert.equal(calls,0);
});
test('client rejects raw or malformed projection',async()=>{
 for(const value of [{session_id:'id',messages:[]},{sessionId:'id',messages:[],omitted:'false'},{sessionId:'id',messages:[{role:'tool',text:'x'}],omitted:false},{sessionId:'id',messages:Array(51).fill({role:'user',text:'x'}),omitted:false}]){
  await assert.rejects(()=>readTranscript({port:0,token:'management-only'},'id',new AbortController().signal,async()=>new Response(JSON.stringify(value))),/HISTORY_INVALID/);
 }
});
