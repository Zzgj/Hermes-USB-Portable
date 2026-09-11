import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startControlServer} from '../scripts/control-server.mjs';
async function setup(t,startInstance,prepareLearn,readCatalog){
 const root=await mkdtemp(join(tmpdir(),'hermes-control-')),assets=join(root,'assets');await mkdir(assets);await writeFile(join(assets,'index.html'),'<h1>fixture</h1>');
 const service=await startControlServer({assets,startInstance,prepareLearn,readCatalog});t.after(async()=>{await service.close();await rm(root,{recursive:true,force:true});});
 const call=(path,options={})=>fetch(service.origin+path,{...options,headers:{Origin:service.origin,Authorization:`Bearer ${service.token}`,...options.headers}});
 return {service,call,root,assets};
}
test('API rejects missing token or foreign Origin without starting anything',async t=>{
 let starts=0;const {service,call}=await setup(t,async()=>{starts++;});
 assert.equal((await fetch(service.origin+'/api/status')).status,403);
 assert.equal((await call('/api/start',{method:'POST',headers:{Origin:'https://foreign.invalid'}})).status,403);
 assert.equal((await call('/api/start',{method:'GET'})).status,404);assert.equal(starts,0);
});
test('catalog requires an authenticated ready instance and accepts no target path',async t=>{
 let calls=0;const {call,service}=await setup(t,async()=>({state:'ready',connection:Promise.resolve({port:1234,token:'fixture'}),stop:async()=>{}}),undefined,async(...args)=>{assert.equal(args.length,0);calls++;return {cards:[],availability:'unknown'};});
 assert.equal((await call('/api/capabilities/catalog')).status,409);
 await call('/api/start',{method:'POST'});
 assert.equal((await fetch(service.origin+'/api/capabilities/catalog')).status,403);
 assert.equal((await call('/api/capabilities/catalog',{method:'POST',body:'arbitrary-path'})).status,404);
 assert.deepEqual(await (await call('/api/capabilities/catalog')).json(),{cards:[],availability:'unknown'});assert.equal(calls,1);
});
test('authorized start returns in-memory connection, stop only uses its handle',async t=>{
 let stops=0,starts=0;const {call,service}=await setup(t,async()=>{starts++;return {state:'ready',connection:Promise.resolve({port:12345,token:'fixture-only'}),stop:async()=>{stops++;}};});
 assert.deepEqual(await (await call('/api/status')).json(),{state:'idle'});
 assert.equal((await call('/api/start',{method:'POST'})).status,200);
 assert.equal((await (await call('/api/connection')).json()).connection.token,'fixture-only');
 assert.equal((await call('/api/start',{method:'POST'})).status,409);assert.equal(starts,1);
 const status=await call('/api/status');assert.equal((await status.text()).includes('fixture-only'),false);
 await call('/api/stop',{method:'POST'});await service.close();assert.equal(stops,1);
});
test('reject command payload and traversal through linked assets',async t=>{
 const {root,assets,call,service}=await setup(t,async()=>{throw new Error('must not start');});
 assert.equal((await call('/api/start',{method:'POST',body:'command'})).status,400);
 await writeFile(join(root,'outside.html'),'private');await symlink(join(root,'outside.html'),join(assets,'escape.html'));
 assert.equal((await fetch(service.origin+'/escape.html')).status,404);
 const page=await fetch(service.origin+'/');assert.equal(page.status,200);assert.equal(page.headers.get('cache-control'),'no-store');assert.equal((await page.text()).includes(service.token),false);
});
test('concurrent start is rejected and close waits for pending startup',async t=>{
 let release,stops=0;const {call,service}=await setup(t,()=>new Promise(resolve=>{release=()=>resolve({state:'ready',connection:Promise.resolve({port:12345,token:'fixture'}),stop:async()=>{stops++;}});}));
 const first=call('/api/start',{method:'POST'});
 while(!release)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal((await call('/api/start',{method:'POST'})).status,409);
 const closed=service.close();release();await first;await closed;assert.equal(stops,1);
});
test('learning preparation is authenticated, instance-bound, bounded and never starts a model',async t=>{
 let prepared=0;const {call,service}=await setup(t,async()=>({state:'ready',connection:Promise.resolve({port:1234,token:'fixture'}),stop:async()=>{}}),async input=>{prepared++;assert.deepEqual(input,{source:'中文来源',scope:'draft only'});return {kind:'learn',prompt:'fixture',builderFingerprint:'a'.repeat(64)};});
 const options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'中文来源',scope:'draft only'})};
 assert.equal((await call('/api/learn/prepare',options)).status,409);
 await call('/api/start',{method:'POST'});
 assert.equal((await fetch(service.origin+'/api/learn/prepare',options)).status,403);
 assert.equal((await call('/api/learn/prepare',{...options,body:JSON.stringify({source:'x',scope:'y',command:'unexpected'})})).status,400);
 const response=await call('/api/learn/prepare',options);assert.equal(response.status,200);const result=await response.json();assert.equal(result.prepared.kind,'learn');assert.equal(result.connection.port,1234);assert.equal(prepared,1);
 const csp=(await fetch(service.origin+'/')).headers.get('content-security-policy');assert.match(csp,/connect-src[^;]*http:\/\/127\.0\.0\.1:\*/);assert.doesNotMatch(csp,/https:\/\/\*/);
});
