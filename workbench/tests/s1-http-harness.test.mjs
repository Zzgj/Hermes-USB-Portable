import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,access,mkdtemp,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
const entryNames=['s1-control-server.mjs','s1-browser-launch.mjs'];
function childRun(code){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--input-type=module','-e',code],{stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';const timer=setTimeout(()=>{child.kill();reject(new Error('ENTRY_TIMEOUT'));},5000);
  child.stdout.on('data',b=>{stdout+=b;});child.stderr.on('data',b=>{stderr+=b;});
  child.on('error',reject);child.on('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});child.stdin.end();
 });
}
for(const entry of entryNames){
 test(`entry ${entry} never writes credentials or URLs to stdout/stderr`,async()=>{
  const result=await childRun(`await import(${JSON.stringify(new URL(entry,import.meta.url).href)});`);
  // Check lengths, not strings: a failing assertion must not print a credential.
  assert.equal(result.stdout.length,0,'entry emitted stdout');assert.equal(result.stderr.length,0,'entry emitted stderr');assert.equal(result.code,0);
 });
 test(`entry ${entry} exposes a silent in-process lifecycle`,async t=>{
  const assets=await makeAssets(t);
  const result=await childRun(`const m=await import(${JSON.stringify(new URL(entry,import.meta.url).href)}); const h=await m.startS1Harness({assets:${JSON.stringify(assets)}}); await h.close();`);
  assert.equal(result.stdout.length,0);assert.equal(result.stderr.length,0);assert.equal(result.code,0);
 });
}
async function makeAssets(t){
 const assets=await mkdtemp(join(tmpdir(),'p2-r4-assets-'));t.after(()=>rm(assets,{recursive:true,force:true}));
 await writeFile(join(assets,'index.html'),'<div id="root">Synthetic asset</div>');return assets;
}
async function setup(t,options={}){
 const assets=await makeAssets(t);
 const {startS1Harness}=await import('./s1-control-server.mjs');const h=await startS1Harness({assets,...options});t.after(()=>h.close());return h;
}
function call(h,path,options={}){return fetch(h.origin+path,{...options,headers:{Origin:h.origin,Authorization:`Bearer ${h.token}`,...options.headers}});}
async function start(h){assert.equal((await call(h,'/api/start',{method:'POST'})).status,200);}
async function card(h){return (await (await call(h,'/api/capabilities/catalog')).json()).cards[0];}
const prepare=(h,c)=>call(h,'/api/capabilities/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({card:c,values:{}})});
test('real management HTTP rejects missing/wrong/RPC credentials and foreign Origin',async t=>{
 const h=await setup(t);
 for(const token of ['', 'invalid', h.rpc.token])assert.equal((await call(h,'/api/status',{headers:{Authorization:`Bearer ${token}`}})).status,403);
 assert.equal((await fetch(h.origin+'/api/status')).status,403);
 assert.equal((await call(h,'/api/start',{method:'POST',headers:{Origin:'http://foreign.invalid'}})).status,403);
 assert.equal(h.stats.starts,0);
});
test('real static assets and state endpoints; management and RPC identities differ',async t=>{
 const h=await setup(t);const page=await fetch(h.origin+'/');assert.equal(page.status,200);assert.match(await page.text(),/root/);
 assert.equal((await call(h,'/api/capabilities/catalog')).status,409);await start(h);
 const connection=(await (await call(h,'/api/connection')).json()).connection;
 assert.equal(connection.token!==h.token,true);assert.notEqual(connection.port,Number(new URL(h.origin).port));
 for(const path of ['/api/status','/api/connection','/api/capabilities/catalog'])assert.equal((await (await call(h,path)).text()).includes(h.token),false);
});
test('real catalog and prepare read synthetic files without starting an executor',async t=>{
 const h=await setup(t);await start(h);const c=await card(h);assert.equal(c.state,'draft');
 const response=await prepare(h,c);assert.equal(response.status,200);const value=await response.json();
 assert.equal(value.prepared.method.fingerprint,c.method.fingerprint);assert.equal(value.connection.token===h.rpc.token,true);
 assert.match(value.prepared.prompt,/locate and read/);assert.equal(h.stats.prepareCalls,1);
 assert.equal(h.stats.starts,1);
 assert.equal((await readFile(h.skillPath,'utf8')).includes('Synthetic'),true);
 // No RPC socket or executor is created by the harness. This does not test real Hermes side effects.
});
test('changed Skill fails real second prepare with internal CHANGED evidence',async t=>{
 const h=await setup(t);await start(h);const c=await card(h);assert.equal((await prepare(h,c)).status,200);
 await h.changeSkill();const response=await prepare(h,c);assert.equal(response.status,400);
 assert.equal((await response.json()).error,'CAPABILITY_PREPARATION_FAILED');assert.equal(h.stats.changedRejections,1);

});
test('controlled delayed prepare and isolated idempotent cleanup',{timeout:5000},async t=>{
 const a=await setup(t),b=await setup(t);await start(a);await start(b);const c=await card(a);
 a.holdNextPrepare();const request=prepare(a,c);await a.waitForHeldPrepare();
 assert.equal(a.stats.held,true);a.releasePrepare();assert.equal((await request).status,200);
 await a.close();await a.close();assert.equal(a.stats.stops,1);assert.equal(b.stats.stops,0);
 await assert.rejects(access(a.home));await assert.rejects(fetch(a.origin+'/'));
 assert.equal((await call(b,'/api/status')).status,200);
});
test('failed startup cleans only owned synthetic home',async()=>{
 const {startS1Harness}=await import('./s1-control-server.mjs');
 const before=(await readdir(tmpdir())).filter(x=>x.startsWith('p2-r4-lead-')).sort();
 await assert.rejects(startS1Harness({assets:fileURLToPath(new URL('./not-present-assets',import.meta.url))}));
 assert.deepEqual((await readdir(tmpdir())).filter(x=>x.startsWith('p2-r4-lead-')).sort(),before);
});
test('RPC-only browser fixture preserves fetch and XHR and records explicit submits',async()=>{
 const fetchSentinel=()=>{},xhrSentinel=function(){};
 const window={fetch:fetchSentinel,XMLHttpRequest:xhrSentinel};
 runInNewContext(await readFile(new URL('./s1-rpc-only-fixture.js',import.meta.url),'utf8'),{window,EventTarget,MessageEvent,Event,setTimeout,clearTimeout,URL});
 assert.equal(window.fetch,fetchSentinel);assert.equal(window.XMLHttpRequest,xhrSentinel);
 const ws=new window.WebSocket('ws://127.0.0.1:12345/?token=synthetic');
 await new Promise(resolve=>setTimeout(resolve,20));
 ws.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'prompt.submit',params:{text:'hold'}}));
 assert.equal(window.__p2RpcRequests.filter(x=>x.method==='prompt.submit').length,1);ws.close();
});
